import {
  PhotoRecord,
  getUnmergedPhotos,
  computeImageHash,
  setPhotoHash,
  markPhotoMerged,
  markPhotoAsUploaded,
  incrementUploadCount,
} from "./photo-storage";
import { compressForUpload, getServerBase, CompressionSettings, DEFAULT_COMPRESSION } from "./upload";

export interface MergeResult {
  total: number;
  claimed: number;
  uploaded: number;
  linked: number;
  failed: number;
}

export interface MergeProgress {
  phase: "scanning" | "hashing" | "checking" | "uploading" | "claiming" | "done";
  current: number;
  total: number;
  message: string;
}

async function claimGuestOnServer(userPhone: string, serials: string[]): Promise<number> {
  if (serials.length === 0) return 0;
  try {
    const res = await fetch(`${getServerBase()}/api/merge/claim-guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPhone, serials }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.claimed ?? 0;
  } catch {
    return 0;
  }
}

async function checkHashesOnServer(
  hashes: string[],
): Promise<Record<string, { file_path: string; serial_number: string }>> {
  if (hashes.length === 0) return {};
  try {
    const res = await fetch(`${getServerBase()}/api/merge/check-hashes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashes }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.results ?? {};
  } catch {
    return {};
  }
}

async function linkUploadOnServer(
  userPhone: string,
  photo: PhotoRecord,
  filePath: string,
  imageHash: string,
  fileSizeKb: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${getServerBase()}/api/merge/link-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPhone,
        serialNumber: photo.serialNumber,
        filePath,
        imageHash,
        latitude: photo.latitude,
        longitude: photo.longitude,
        altitude: photo.altitude ?? 0,
        address: photo.address,
        locationName: photo.locationName || "",
        plusCode: photo.plusCode || "",
        fileSizeKb,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function uploadFreshOnServer(
  userPhone: string,
  photo: PhotoRecord,
  imageHash: string,
  compression: CompressionSettings,
): Promise<boolean> {
  try {
    const compressed = await compressForUpload(photo.uri, compression);
    const formData = new FormData();
    formData.append("photo", {
      uri: compressed.uri,
      type: compressed.mimeType,
      name: `${photo.serialNumber}.${compressed.ext}`,
    } as unknown as Blob);
    formData.append("serialNumber", photo.serialNumber);
    formData.append("latitude", String(photo.latitude));
    formData.append("longitude", String(photo.longitude));
    formData.append("altitude", String(photo.altitude ?? 0));
    formData.append("address", photo.address);
    formData.append("locationName", photo.locationName || "");
    formData.append("plusCode", photo.plusCode || "");
    formData.append("timestamp", String(photo.timestamp));
    formData.append("imageHash", imageHash);

    const res = await fetch(`${getServerBase()}/api/upload`, {
      method: "POST",
      headers: {
        "X-User-Phone": userPhone,
        "X-Is-Guest": "false",
      },
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mergeGuestActivity(
  userPhone: string,
  compression: CompressionSettings = DEFAULT_COMPRESSION,
  onProgress?: (progress: MergeProgress) => void,
): Promise<MergeResult> {
  const result: MergeResult = { total: 0, claimed: 0, uploaded: 0, linked: 0, failed: 0 };

  onProgress?.({ phase: "scanning", current: 0, total: 0, message: "Scanning local photos…" });

  const unmerged = await getUnmergedPhotos();
  if (unmerged.length === 0) return result;

  result.total = unmerged.length;

  const alreadyUploaded = unmerged.filter((p) => !!p.uploadedAt);
  const notUploaded = unmerged.filter((p) => !p.uploadedAt);

  if (alreadyUploaded.length > 0) {
    onProgress?.({ phase: "claiming", current: 0, total: alreadyUploaded.length, message: "Claiming uploaded photos…" });
    const serials = alreadyUploaded.map((p) => p.serialNumber);
    const claimed = await claimGuestOnServer(userPhone, serials);
    result.claimed = claimed;
    for (const p of alreadyUploaded) {
      await markPhotoMerged(p.id, userPhone);
    }
  }

  if (notUploaded.length > 0) {
    const hashes: { photo: PhotoRecord; hash: string }[] = [];

    for (let i = 0; i < notUploaded.length; i++) {
      const photo = notUploaded[i];
      onProgress?.({
        phase: "hashing",
        current: i + 1,
        total: notUploaded.length,
        message: `Computing hash ${i + 1}/${notUploaded.length}…`,
      });

      let hash = photo.imageHash || "";
      if (!hash) {
        hash = await computeImageHash(photo.uri);
        if (hash) await setPhotoHash(photo.id, hash);
      }
      hashes.push({ photo, hash });
    }

    const hashStrings = hashes.map((h) => h.hash).filter(Boolean);
    onProgress?.({ phase: "checking", current: 0, total: hashStrings.length, message: "Checking server for duplicates…" });
    const existingMap = await checkHashesOnServer(hashStrings);

    for (let i = 0; i < hashes.length; i++) {
      const { photo, hash } = hashes[i];
      onProgress?.({
        phase: "uploading",
        current: i + 1,
        total: hashes.length,
        message: `Processing ${i + 1}/${hashes.length}…`,
      });

      try {
        if (hash && existingMap[hash]) {
          const existing = existingMap[hash];
          const linked = await linkUploadOnServer(userPhone, photo, existing.file_path, hash, 0);
          if (linked) {
            await markPhotoMerged(photo.id, userPhone);
            await markPhotoAsUploaded(photo.id);
            await incrementUploadCount();
            result.linked++;
          } else {
            result.failed++;
          }
        } else {
          const uploaded = await uploadFreshOnServer(userPhone, photo, hash, compression);
          if (uploaded) {
            await markPhotoMerged(photo.id, userPhone);
            await markPhotoAsUploaded(photo.id);
            await incrementUploadCount();
            result.uploaded++;
          } else {
            result.failed++;
          }
        }
      } catch {
        result.failed++;
      }
    }
  }

  onProgress?.({ phase: "done", current: result.total, total: result.total, message: "Merge complete" });
  return result;
}

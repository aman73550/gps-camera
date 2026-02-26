import * as ImageManipulator from "expo-image-manipulator";
import {
  isWhitelisted,
  getPhotoByUri,
  getUploadCount,
  incrementUploadCount,
  getPhotosDirectory,
  PhotoRecord,
} from "./photo-storage";
import { Platform } from "react-native";

const MAX_GUEST_UPLOADS = 20;

export const GUEST_LIMIT_ERROR = "GUEST_LIMIT_REACHED";

function getServerBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    // EXPO_PUBLIC_DOMAIN is "hostname:5000" — strip port, use HTTPS (Replit proxy)
    const host = domain.split(":")[0];
    return `https://${host}`;
  }
  return "http://localhost:5000";
}

export async function compressForUpload(
  uri: string,
): Promise<{ uri: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1000 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result;
}

export async function runVerificationChain(photo: PhotoRecord): Promise<void> {
  // ── Lock 1: Path check — must be inside app's private directory ──────────
  const photosDir = getPhotosDirectory();
  if (!photo.uri.startsWith(photosDir)) {
    throw new Error("Unauthorized File: Image is outside the app's secure storage.");
  }

  // ── Lock 2: Database (Whitelist) check — must have a DB entry ────────────
  const whitelisted = await isWhitelisted(photo.uri);
  if (!whitelisted) {
    throw new Error("Unauthorized File: No database record found for this image.");
  }

  // ── Lock 3: Metadata match — serial number in DB must match the record ───
  const dbRecord = await getPhotoByUri(photo.uri);
  if (!dbRecord) {
    throw new Error("Unauthorized File: Image record not found in database.");
  }
  if (dbRecord.serialNumber !== photo.serialNumber) {
    throw new Error(
      `Metadata Mismatch: Serial number "${photo.serialNumber}" does not match database record "${dbRecord.serialNumber}".`,
    );
  }

  // ── Lock 4: Tier check — guest upload limit ───────────────────────────────
  const currentUploads = await getUploadCount();
  if (currentUploads >= MAX_GUEST_UPLOADS) {
    throw new Error(GUEST_LIMIT_ERROR);
  }
}

export async function uploadPhoto(
  photo: PhotoRecord,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Verifying…");
  await runVerificationChain(photo);

  onProgress?.("Compressing…");
  const compressed = await compressForUpload(photo.uri);

  onProgress?.("Uploading…");
  const formData = new FormData();
  formData.append("photo", {
    uri: compressed.uri,
    type: "image/jpeg",
    name: `${photo.serialNumber}.jpg`,
  } as unknown as Blob);
  formData.append("serialNumber", photo.serialNumber);
  formData.append("latitude", String(photo.latitude));
  formData.append("longitude", String(photo.longitude));
  formData.append("address", photo.address);
  formData.append("timestamp", String(photo.timestamp));

  const response = await fetch(`${getServerBase()}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed: ${body || response.statusText}`);
  }

  await incrementUploadCount();
  onProgress?.("Done");
}

export async function uploadPhotoBatch(
  photos: PhotoRecord[],
  onProgress?: (current: number, total: number, status: string) => void,
): Promise<{ succeeded: string[]; failed: { serial: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { serial: string; error: string }[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      await uploadPhoto(photo, (status) =>
        onProgress?.(i + 1, photos.length, `${photo.serialNumber}: ${status}`),
      );
      succeeded.push(photo.serialNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      failed.push({ serial: photo.serialNumber, error: message });
      if (message === GUEST_LIMIT_ERROR) break;
    }
  }

  return { succeeded, failed };
}

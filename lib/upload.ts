import * as ImageManipulator from "expo-image-manipulator";
import {
  isWhitelisted,
  getPhotoByUri,
  getUploadCount,
  incrementUploadCount,
  markPhotoAsUploaded,
  setPendingUpload,
  getPhotosDirectory,
  PhotoRecord,
} from "./photo-storage";
import { Platform } from "react-native";

export const NETWORK_ERROR = "NETWORK_OFFLINE";

const MAX_GUEST_UPLOADS = 20;

export const GUEST_LIMIT_ERROR = "GUEST_LIMIT_REACHED";
export const DAILY_LIMIT_ERROR = "DAILY_LIMIT_REACHED";
export const MONTHLY_LIMIT_ERROR = "MONTHLY_LIMIT_REACHED";

export function getServerBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const host = domain.split(":")[0];
    return `https://${host}`;
  }
  return "http://localhost:5000";
}

function getImageFormat(): {
  format: ImageManipulator.SaveFormat;
  mimeType: string;
  ext: string;
} {
  if (Platform.OS === "android") {
    return {
      format: ImageManipulator.SaveFormat.WEBP,
      mimeType: "image/webp",
      ext: "webp",
    };
  }
  return {
    format: ImageManipulator.SaveFormat.JPEG,
    mimeType: "image/jpeg",
    ext: "jpg",
  };
}

export async function compressForUpload(
  uri: string,
): Promise<{ uri: string; ext: string; mimeType: string }> {
  const { format, mimeType, ext } = getImageFormat();
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1000 } }],
    { compress: 0.5, format },
  );
  return { uri: result.uri, ext, mimeType };
}

export async function runVerificationChain(
  photo: PhotoRecord,
  isLoggedIn = false,
): Promise<void> {
  const photosDir = getPhotosDirectory();
  if (!photo.uri.startsWith(photosDir)) {
    throw new Error("Unauthorized File: Image is outside the app's secure storage.");
  }

  const whitelisted = await isWhitelisted(photo.uri);
  if (!whitelisted) {
    throw new Error("Unauthorized File: No database record found for this image.");
  }

  const dbRecord = await getPhotoByUri(photo.uri);
  if (!dbRecord) {
    throw new Error("Unauthorized File: Image record not found in database.");
  }
  if (dbRecord.serialNumber !== photo.serialNumber) {
    throw new Error(
      `Metadata Mismatch: Serial number "${photo.serialNumber}" does not match database record "${dbRecord.serialNumber}".`,
    );
  }

  if (!isLoggedIn) {
    const currentUploads = await getUploadCount();
    if (currentUploads >= MAX_GUEST_UPLOADS) {
      throw new Error(GUEST_LIMIT_ERROR);
    }
  }
}

export async function uploadPhoto(
  photo: PhotoRecord,
  onProgress?: (status: string) => void,
  isLoggedIn = false,
  userPhone?: string | null,
): Promise<void> {
  onProgress?.("Verifying…");
  await runVerificationChain(photo, isLoggedIn);

  onProgress?.("Compressing…");
  const compressed = await compressForUpload(photo.uri);

  onProgress?.("Uploading…");
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

  const headers: Record<string, string> = {};
  if (userPhone) {
    headers["X-User-Phone"] = userPhone;
    headers["X-Is-Guest"] = "false";
  } else {
    headers["X-Is-Guest"] = "true";
  }

  let response: Response;
  try {
    response = await fetch(`${getServerBase()}/api/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    await setPendingUpload(photo.id, true);
    throw new Error(NETWORK_ERROR);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: response.statusText }));
    const errorCode = data?.error;
    if (errorCode === "GUEST_LIMIT") throw new Error(GUEST_LIMIT_ERROR);
    if (errorCode === "DAILY_LIMIT") throw new Error(DAILY_LIMIT_ERROR);
    if (errorCode === "MONTHLY_LIMIT") throw new Error(MONTHLY_LIMIT_ERROR);
    throw new Error(`Upload failed: ${JSON.stringify(data)}`);
  }

  await setPendingUpload(photo.id, false);
  await incrementUploadCount();
  await markPhotoAsUploaded(photo.id);
  onProgress?.("Done");
}

interface UploadMetadata {
  serialNumber: string;
  latitude: number;
  longitude: number;
  altitude: number;
  address: string;
  locationName: string;
  plusCode: string;
  timestamp: number;
  filePath: string;
  fileSizeKb: number;
}

async function recordUploadsBatch(
  metadata: UploadMetadata[],
  userPhone: string | null,
  isGuest: boolean,
): Promise<void> {
  if (metadata.length === 0) return;
  try {
    await fetch(`${getServerBase()}/api/record-uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userPhone ? { "X-User-Phone": userPhone } : {}),
        "X-Is-Guest": isGuest ? "true" : "false",
      },
      body: JSON.stringify({ uploads: metadata }),
    });
  } catch {
  }
}

export async function uploadPhotoBatch(
  photos: PhotoRecord[],
  onProgress?: (current: number, total: number, status: string) => void,
  isLoggedIn = false,
  userPhone?: string | null,
): Promise<{ succeeded: string[]; failed: { serial: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { serial: string; error: string }[] = [];
  const batchMetadata: UploadMetadata[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      onProgress?.(i + 1, photos.length, `${photo.serialNumber}: Verifying…`);
      await runVerificationChain(photo, isLoggedIn);

      onProgress?.(i + 1, photos.length, `${photo.serialNumber}: Compressing…`);
      const compressed = await compressForUpload(photo.uri);

      onProgress?.(i + 1, photos.length, `${photo.serialNumber}: Uploading…`);
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

      const headers: Record<string, string> = { "X-Skip-Record": "true" };
      if (userPhone) {
        headers["X-User-Phone"] = userPhone;
        headers["X-Is-Guest"] = "false";
      } else {
        headers["X-Is-Guest"] = "true";
      }

      let response: Response;
      try {
        response = await fetch(`${getServerBase()}/api/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
      } catch {
        await setPendingUpload(photo.id, true);
        throw new Error(NETWORK_ERROR);
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: response.statusText }));
        const errorCode = data?.error;
        if (errorCode === "GUEST_LIMIT") throw new Error(GUEST_LIMIT_ERROR);
        if (errorCode === "DAILY_LIMIT") throw new Error(DAILY_LIMIT_ERROR);
        if (errorCode === "MONTHLY_LIMIT") throw new Error(MONTHLY_LIMIT_ERROR);
        throw new Error(`Upload failed: ${JSON.stringify(data)}`);
      }

      const responseData = await response.json().catch(() => ({}));
      const filePath: string = responseData.filePath || `${photo.serialNumber}.${compressed.ext}`;

      await setPendingUpload(photo.id, false);
      await incrementUploadCount();
      await markPhotoAsUploaded(photo.id);

      batchMetadata.push({
        serialNumber: photo.serialNumber,
        latitude: photo.latitude,
        longitude: photo.longitude,
        altitude: photo.altitude ?? 0,
        address: photo.address,
        locationName: photo.locationName || "",
        plusCode: photo.plusCode || "",
        timestamp: photo.timestamp,
        filePath,
        fileSizeKb: Math.round((compressed.uri.length * 0.75) / 1024),
      });

      succeeded.push(photo.serialNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      failed.push({ serial: photo.serialNumber, error: message });
      if (
        message === GUEST_LIMIT_ERROR ||
        message === DAILY_LIMIT_ERROR ||
        message === MONTHLY_LIMIT_ERROR
      )
        break;
    }
  }

  if (batchMetadata.length > 0) {
    await recordUploadsBatch(batchMetadata, userPhone ?? null, !isLoggedIn);
  }

  return { succeeded, failed };
}

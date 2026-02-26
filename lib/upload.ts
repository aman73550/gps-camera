import * as ImageManipulator from "expo-image-manipulator";
import { isWhitelisted, PhotoRecord } from "./photo-storage";
import { Platform } from "react-native";

const SERVER_BASE =
  Platform.OS === "web"
    ? `http://localhost:5000`
    : `http://${process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000"}`;

export async function compressForUpload(
  uri: string,
): Promise<{ uri: string; size?: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1000 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result;
}

export async function uploadPhoto(
  photo: PhotoRecord,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Verifying…");

  const allowed = await isWhitelisted(photo.uri);
  if (!allowed) {
    throw new Error("Unauthorized File: This image is not registered in the app database.");
  }

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

  const response = await fetch(`${SERVER_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed: ${body || response.statusText}`);
  }

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
      failed.push({
        serial: photo.serialNumber,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}

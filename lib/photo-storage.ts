import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";

export interface PhotoRecord {
  id: string;
  serialNumber: string;
  uri: string;
  latitude: number;
  longitude: number;
  address: string;
  timestamp: number;
  compressed: boolean;
}

const PHOTOS_KEY = "@gps_camera_photos";
const COUNTER_KEY = "@gps_camera_counter";
const UPLOAD_COUNT_KEY = "@gps_camera_upload_count";

export function getPhotosDirectory(): string {
  return `${FileSystem.documentDirectory}gps_camera_photos/`;
}

export async function ensurePhotosDirectory(): Promise<void> {
  const dir = getPhotosDirectory();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function generateSerialNumber(): Promise<string> {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const counterStr = await AsyncStorage.getItem(COUNTER_KEY);
  let counter = counterStr ? parseInt(counterStr, 10) : 0;
  counter += 1;
  await AsyncStorage.setItem(COUNTER_KEY, counter.toString());

  return `IMG-${dateStr}-${String(counter).padStart(3, "0")}`;
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  const data = await AsyncStorage.getItem(PHOTOS_KEY);
  if (!data) return [];
  const photos: PhotoRecord[] = JSON.parse(data);
  return photos.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getPhotoBySerial(
  serial: string,
): Promise<PhotoRecord | undefined> {
  const photos = await getAllPhotos();
  return photos.find(
    (p) => p.serialNumber.toLowerCase() === serial.toLowerCase(),
  );
}

export async function savePhotoRecord(record: PhotoRecord): Promise<void> {
  const photos = await getAllPhotos();
  photos.push(record);
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

export async function deletePhotoRecord(id: string): Promise<void> {
  const photos = await getAllPhotos();
  const photo = photos.find((p) => p.id === id);
  if (photo) {
    try {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch {}
  }
  const filtered = photos.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(filtered));
}

export async function isWhitelisted(uri: string): Promise<boolean> {
  const photos = await getAllPhotos();
  const photosDir = getPhotosDirectory();
  if (!uri.startsWith(photosDir)) return false;
  return photos.some((p) => p.uri === uri);
}

export async function getUploadCount(): Promise<number> {
  const count = await AsyncStorage.getItem(UPLOAD_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

export async function incrementUploadCount(): Promise<number> {
  const current = await getUploadCount();
  const next = current + 1;
  await AsyncStorage.setItem(UPLOAD_COUNT_KEY, next.toString());
  return next;
}

export function generateId(): string {
  return Crypto.randomUUID();
}

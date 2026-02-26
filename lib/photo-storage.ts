import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

export interface PhotoRecord {
  id: string;
  serialNumber: string;
  uri: string;
  latitude: number;
  longitude: number;
  altitude: number;
  address: string;
  locationName: string;
  plusCode: string;
  nearPlace?: string;
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

export function computePlusCode(lat: number, lon: number): string {
  try {
    const { OpenLocationCode } = require("open-location-code");
    const olc = new OpenLocationCode();
    return olc.encode(lat, lon, 10);
  } catch {
    const ALPHA = "23456789CFGHJMPQRVWX";
    const norm = (v: number, range: number, n: number): number[] => {
      const digits: number[] = [];
      let x = ((v % range) + range) % range;
      for (let i = 0; i < n; i++) {
        const step = range / Math.pow(20, i + 1);
        digits.push(Math.floor(x / step) % 20);
      }
      return digits;
    };
    const la = norm(lat + 90, 180, 4);
    const lo = norm(lon + 180, 360, 4);
    let code = "";
    for (let i = 0; i < 4; i++) code += ALPHA[la[i]] + ALPHA[lo[i]];
    return code.slice(0, 8) + "+" + code.slice(8, 10).padEnd(2, "2");
  }
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    if (!data) return [];
    const photos: PhotoRecord[] = JSON.parse(data);
    return photos.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function getPhotoBySerial(
  serial: string,
): Promise<PhotoRecord | undefined> {
  const photos = await getAllPhotos();
  return photos.find(
    (p) => p.serialNumber.toLowerCase() === serial.toLowerCase(),
  );
}

export async function getPhotoByUri(
  uri: string,
): Promise<PhotoRecord | undefined> {
  const photos = await getAllPhotos();
  return photos.find((p) => p.uri === uri);
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

export function formatDateLong(timestamp: number): string {
  const date = new Date(timestamp);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${h}:${m}:${s}`;
}

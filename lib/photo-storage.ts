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
  note?: string;
  timestamp: number;
  compressed: boolean;
  uploadedAt?: number;
  pendingUpload?: boolean;
  deletedAt?: number;
  serverDeleteRequested?: boolean;
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

async function _readAllRaw(): Promise<PhotoRecord[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    return data ? (JSON.parse(data) as PhotoRecord[]) : [];
  } catch {
    return [];
  }
}

async function _writeAll(photos: PhotoRecord[]): Promise<void> {
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  const all = await _readAllRaw();
  return all
    .filter((p) => !p.deletedAt && !p.serverDeleteRequested)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getTrashPhotos(): Promise<PhotoRecord[]> {
  const all = await _readAllRaw();
  return all
    .filter((p) => !!p.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
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
  const all = await _readAllRaw();
  all.push(record);
  await _writeAll(all);
}

export async function deletePhotoRecord(id: string): Promise<void> {
  const all = await _readAllRaw();
  const idx = all.findIndex((p) => p.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], deletedAt: Date.now() };
    await _writeAll(all);
  }
}

export async function restorePhoto(id: string): Promise<void> {
  const all = await _readAllRaw();
  const idx = all.findIndex((p) => p.id === id);
  if (idx !== -1) {
    const { deletedAt: _deleted, ...rest } = all[idx];
    void _deleted;
    all[idx] = rest as PhotoRecord;
    await _writeAll(all);
  }
}

export async function permanentlyDeletePhoto(id: string): Promise<void> {
  const all = await _readAllRaw();
  const photo = all.find((p) => p.id === id);
  if (photo) {
    try {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch {}
  }
  await _writeAll(all.filter((p) => p.id !== id));
}

export async function cleanExpiredTrash(days = 7): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const all = await _readAllRaw();
  const expired = all.filter((p) => p.deletedAt && p.deletedAt < cutoff);
  for (const p of expired) {
    try {
      await FileSystem.deleteAsync(p.uri, { idempotent: true });
    } catch {}
  }
  const expiredIds = new Set(expired.map((p) => p.id));
  await _writeAll(all.filter((p) => !expiredIds.has(p.id)));
  return expired.length;
}

export async function isWhitelisted(uri: string): Promise<boolean> {
  const all = await _readAllRaw();
  const photosDir = getPhotosDirectory();
  if (!uri.startsWith(photosDir)) return false;
  return all.filter((p) => !p.deletedAt).some((p) => p.uri === uri);
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

export async function markPhotoAsUploaded(id: string): Promise<void> {
  try {
    const all = await _readAllRaw();
    const idx = all.findIndex((p) => p.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], uploadedAt: Date.now(), pendingUpload: false };
      await _writeAll(all);
    }
  } catch {}
}

export async function markServerDeleteRequested(id: string): Promise<void> {
  try {
    const all = await _readAllRaw();
    const idx = all.findIndex((p) => p.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], serverDeleteRequested: true };
      await _writeAll(all);
    }
  } catch {}
}

export async function setPendingUpload(id: string, pending: boolean): Promise<void> {
  try {
    const all = await _readAllRaw();
    const idx = all.findIndex((p) => p.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], pendingUpload: pending };
      await _writeAll(all);
    }
  } catch {}
}

export async function getPhotosPage(
  offset: number,
  limit: number,
): Promise<{ photos: PhotoRecord[]; total: number }> {
  try {
    const active = await getAllPhotos();
    return { photos: active.slice(offset, offset + limit), total: active.length };
  } catch {
    return { photos: [], total: 0 };
  }
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

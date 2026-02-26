import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_CACHE_KEY = "@gps_camera_last_location";

export interface CachedLocation {
  latitude: number;
  longitude: number;
  altitude: number;
  address: string;
  locationName: string;
  plusCode: string;
  timestamp: number;
}

export async function getCachedLocation(): Promise<CachedLocation | null> {
  try {
    const data = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data) as CachedLocation;
  } catch {
    return null;
  }
}

export async function setCachedLocation(loc: CachedLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(loc));
  } catch {}
}

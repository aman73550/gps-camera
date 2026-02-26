import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from "react";
import * as Network from "expo-network";
import { getServerBase, CompressionSettings, DEFAULT_COMPRESSION } from "@/lib/upload";
import {
  PhotoRecord,
  getAllPhotos,
  getTrashPhotos,
  savePhotoRecord,
  deletePhotoRecord,
  restorePhoto,
  permanentlyDeletePhoto,
  getPhotoBySerial,
  getUploadCount,
  setPendingUpload as storageSetPendingUpload,
} from "@/lib/photo-storage";

export interface TierLimits {
  guestLimit: number;
  standardDailyLimit: number;
  standardMonthlyLimit: number;
}

interface PhotoContextValue {
  photos: PhotoRecord[];
  trashPhotos: PhotoRecord[];
  isLoading: boolean;
  uploadCount: number;
  maxGuestUploads: number;
  tierLimits: TierLimits;
  compressionSettings: CompressionSettings;
  pendingCount: number;
  isOnline: boolean;
  refreshPhotos: () => Promise<void>;
  addPhoto: (record: PhotoRecord) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
  removePhotos: (ids: string[]) => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  searchBySerial: (serial: string) => Promise<PhotoRecord | undefined>;
  filterPhotos: (query: string) => PhotoRecord[];
  setPendingUpload: (id: string, pending: boolean) => Promise<void>;
}

const PhotoContext = createContext<PhotoContextValue | null>(null);

const DEFAULT_TIER_LIMITS: TierLimits = { guestLimit: 20, standardDailyLimit: 50, standardMonthlyLimit: 1000 };

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [trashPhotos, setTrashPhotos] = useState<PhotoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadCount, setUploadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [tierLimits, setTierLimits] = useState<TierLimits>(DEFAULT_TIER_LIMITS);
  const [compressionSettings, setCompressionSettings] = useState<CompressionSettings>(DEFAULT_COMPRESSION);
  const maxGuestUploads = tierLimits.guestLimit;

  const pendingCount = useMemo(
    () => photos.filter((p) => !p.uploadedAt).length,
    [photos],
  );

  const refreshPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allPhotos, trash, count] = await Promise.all([
        getAllPhotos(),
        getTrashPhotos(),
        getUploadCount(),
      ]);
      setPhotos(allPhotos);
      setTrashPhotos(trash);
      setUploadCount(count);
    } catch {
      setPhotos([]);
      setTrashPhotos([]);
      setUploadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPhotos();
  }, [refreshPhotos]);

  useEffect(() => {
    Network.getNetworkStateAsync().then((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    const sub = Network.addNetworkStateListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    fetch(`${getServerBase()}/api/config/limits`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.guestLimit) {
          setTierLimits({
            guestLimit: data.guestLimit,
            standardDailyLimit: data.standardDailyLimit,
            standardMonthlyLimit: data.standardMonthlyLimit,
          });
        }
        if (data.imageMaxWidth) {
          setCompressionSettings({
            maxWidth: data.imageMaxWidth,
            quality: data.imageQuality ?? 50,
            format: data.imageFormat ?? "auto",
            maxFileMb: data.imageMaxFileMb ?? 5,
          });
        }
      })
      .catch(() => {});
  }, []);

  const addPhoto = useCallback(
    async (record: PhotoRecord) => {
      await savePhotoRecord(record);
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const removePhoto = useCallback(
    async (id: string) => {
      await deletePhotoRecord(id);
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const removePhotos = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        await deletePhotoRecord(id);
      }
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const restoreFromTrash = useCallback(
    async (id: string) => {
      await restorePhoto(id);
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const permanentlyDelete = useCallback(
    async (id: string) => {
      await permanentlyDeletePhoto(id);
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const emptyTrash = useCallback(async () => {
    for (const p of trashPhotos) {
      await permanentlyDeletePhoto(p.id);
    }
    await refreshPhotos();
  }, [trashPhotos, refreshPhotos]);

  const searchBySerial = useCallback(async (serial: string) => {
    return getPhotoBySerial(serial);
  }, []);

  const filterPhotos = useCallback(
    (query: string) => {
      if (!query.trim()) return photos;
      const q = query.toLowerCase();
      return photos.filter(
        (p) =>
          p.serialNumber.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q),
      );
    },
    [photos],
  );

  const setPendingUpload = useCallback(
    async (id: string, pending: boolean) => {
      await storageSetPendingUpload(id, pending);
      await refreshPhotos();
    },
    [refreshPhotos],
  );

  const value = useMemo(
    () => ({
      photos,
      trashPhotos,
      isLoading,
      uploadCount,
      maxGuestUploads,
      tierLimits,
      compressionSettings,
      pendingCount,
      isOnline,
      refreshPhotos,
      addPhoto,
      removePhoto,
      removePhotos,
      restoreFromTrash,
      permanentlyDelete,
      emptyTrash,
      searchBySerial,
      filterPhotos,
      setPendingUpload,
    }),
    [
      photos,
      trashPhotos,
      isLoading,
      uploadCount,
      maxGuestUploads,
      tierLimits,
      compressionSettings,
      pendingCount,
      isOnline,
      refreshPhotos,
      addPhoto,
      removePhoto,
      removePhotos,
      restoreFromTrash,
      permanentlyDelete,
      emptyTrash,
      searchBySerial,
      filterPhotos,
      setPendingUpload,
    ],
  );

  return (
    <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>
  );
}

export function usePhotos() {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error("usePhotos must be used within a PhotoProvider");
  }
  return context;
}

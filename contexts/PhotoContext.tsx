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
import {
  PhotoRecord,
  getAllPhotos,
  savePhotoRecord,
  deletePhotoRecord,
  getPhotoBySerial,
  getUploadCount,
  setPendingUpload as storageSetPendingUpload,
} from "@/lib/photo-storage";

interface PhotoContextValue {
  photos: PhotoRecord[];
  isLoading: boolean;
  uploadCount: number;
  maxGuestUploads: number;
  pendingCount: number;
  isOnline: boolean;
  refreshPhotos: () => Promise<void>;
  addPhoto: (record: PhotoRecord) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
  removePhotos: (ids: string[]) => Promise<void>;
  searchBySerial: (serial: string) => Promise<PhotoRecord | undefined>;
  filterPhotos: (query: string) => PhotoRecord[];
  setPendingUpload: (id: string, pending: boolean) => Promise<void>;
}

const PhotoContext = createContext<PhotoContextValue | null>(null);

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadCount, setUploadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const maxGuestUploads = 20;

  const pendingCount = useMemo(
    () => photos.filter((p) => !p.uploadedAt).length,
    [photos],
  );

  const refreshPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const allPhotos = await getAllPhotos();
      setPhotos(allPhotos);
      const count = await getUploadCount();
      setUploadCount(count);
    } catch {
      setPhotos([]);
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
      isLoading,
      uploadCount,
      maxGuestUploads,
      pendingCount,
      isOnline,
      refreshPhotos,
      addPhoto,
      removePhoto,
      removePhotos,
      searchBySerial,
      filterPhotos,
      setPendingUpload,
    }),
    [
      photos,
      isLoading,
      uploadCount,
      maxGuestUploads,
      pendingCount,
      isOnline,
      refreshPhotos,
      addPhoto,
      removePhoto,
      removePhotos,
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

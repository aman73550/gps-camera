import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  InteractionManager,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { PhotoOverlay } from "@/components/PhotoOverlay";
import { router } from "expo-router";
import { FadeInView } from "@/components/FadeInView";
import { getCachedLocation, setCachedLocation } from "@/lib/location-cache";
import {
  generateSerialNumber,
  generateId,
  ensurePhotosDirectory,
  getPhotosDirectory,
  computePlusCode,
  PhotoRecord,
} from "@/lib/photo-storage";

function openSettings() {
  if (Platform.OS !== "web") {
    try {
      Linking.openSettings();
    } catch {}
  }
}

export default function CameraTab() {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [address, setAddress] = useState("Fetching location...");
  const [locationName, setLocationName] = useState("Unknown Location");
  const [plusCode, setPlusCode] = useState("");
  const [nearPlace, setNearPlace] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapturedUri, setLastCapturedUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");

  const { addPhoto, photos, uploadCount, maxGuestUploads } = usePhotos();
  const photoCount = photos.length;

  useEffect(() => {
    if (photos.length > 0 && !lastCapturedUri) {
      setLastCapturedUri(photos[0].uri);
    }
  }, [photos, lastCapturedUri]);

  useEffect(() => {
    getCachedLocation().then((cached) => {
      if (!cached) return;
      setLatitude(cached.latitude);
      setLongitude(cached.longitude);
      setAltitude(cached.altitude);
      setAddress(cached.address);
      setLocationName(cached.locationName);
      setPlusCode(cached.plusCode);
      if (cached.nearPlace) setNearPlace(cached.nearPlace);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const alt = pos.coords.altitude ?? 0;
            setLatitude(lat);
            setLongitude(lon);
            setAltitude(alt);
            setPlusCode(computePlusCode(lat, lon));
            setLocationName("Web Location");
            setAddress("Location detected via browser");
          },
          () => setAddress("Location unavailable"),
          { enableHighAccuracy: true },
        );
        return () => navigator.geolocation.clearWatch(watchId);
      }
      return;
    }

    let watcher: Location.LocationSubscription | null = null;

    const applyLocation = async (lat: number, lon: number, alt: number) => {
      setLatitude(lat);
      setLongitude(lon);
      setAltitude(alt);
      const plus = computePlusCode(lat, lon);
      setPlusCode(plus);
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (reverseGeocode.length > 0) {
          const place = reverseGeocode[0];
          const nameParts = [
            place.name && place.name !== place.street ? place.name : null,
            place.city || place.district,
            place.region,
            place.country,
          ].filter(Boolean);
          const name = nameParts.join(", ") || "Unknown Location";
          const addrParts = [
            place.streetNumber,
            place.street,
            place.city || place.district,
            place.region,
            place.postalCode,
            place.country,
          ].filter(Boolean);
          const addr = addrParts.join(", ") || "Unknown location";

          const rawName = place.name ?? "";
          const nearParts: string[] = [];
          if (rawName && !/^\d+$/.test(rawName) && rawName !== place.street) {
            nearParts.push(rawName);
          }
          if (place.district && place.district !== (place.city || place.district)) {
            nearParts.push(place.district);
          } else if (place.subregion && place.subregion !== place.region) {
            nearParts.push(place.subregion);
          }
          const near = nearParts.join(", ") || place.district || place.subregion || "";

          setLocationName(name);
          setAddress(addr);
          setNearPlace(near);
          setCachedLocation({ latitude: lat, longitude: lon, altitude: alt, address: addr, locationName: name, plusCode: plus, nearPlace: near, timestamp: Date.now() });
        }
      } catch {
        const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setAddress(fallback);
        setCachedLocation({ latitude: lat, longitude: lon, altitude: alt, address: fallback, locationName: "GPS Location", plusCode: plus, nearPlace: "", timestamp: Date.now() });
      }
    };

    const startLocationUpdates = async () => {
      if (!locationPermission?.granted) return;

      try {
        const quick = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await applyLocation(quick.coords.latitude, quick.coords.longitude, quick.coords.altitude ?? 0);
      } catch {}

      try {
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          async (loc) => {
            await applyLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.altitude ?? 0);
          },
        );
      } catch {
        setAddress("Location unavailable");
      }
    };

    startLocationUpdates();
    return () => {
      watcher?.remove();
    };
  }, [locationPermission?.granted]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await ensurePhotosDirectory();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo) {
        setIsCapturing(false);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const serialNumber = await generateSerialNumber();
            const id = generateId();
            const now = new Date();

            const resized = await ImageManipulator.manipulateAsync(
              photo.uri,
              [{ resize: { width: 1200 } }],
              { format: ImageManipulator.SaveFormat.JPEG },
            );

            const targetHeight = Math.round(1200 * (4 / 3));
            const cropActions =
              resized.height > targetHeight
                ? [{ crop: { originX: 0, originY: Math.round((resized.height - targetHeight) / 2), width: 1200, height: targetHeight } }]
                : ([] as { crop: { originX: number; originY: number; width: number; height: number } }[]);

            const compressed = await ImageManipulator.manipulateAsync(
              resized.uri,
              cropActions,
              { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
            );

            const fileName = `${serialNumber}.jpg`;
            const destUri = `${getPhotosDirectory()}${fileName}`;
            await FileSystem.moveAsync({ from: compressed.uri, to: destUri });

            const record: PhotoRecord = {
              id,
              serialNumber,
              uri: destUri,
              latitude,
              longitude,
              altitude,
              address,
              locationName,
              plusCode,
              nearPlace,
              timestamp: now.getTime(),
              compressed: true,
            };

            await addPhoto(record);
            setLastCapturedUri(destUri);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      console.error("Capture error:", err);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, latitude, longitude, altitude, address, locationName, plusCode, nearPlace, addPhoto]);

  const toggleCamera = useCallback(() => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!cameraPermission || !locationPermission) {
    return (
      <View style={[styles.centerContainer, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  const cameraDeniedPermanently =
    !cameraPermission.granted &&
    cameraPermission.status === "denied" &&
    !cameraPermission.canAskAgain;

  const locationDeniedPermanently =
    !locationPermission.granted &&
    locationPermission.status === "denied" &&
    !locationPermission.canAskAgain;

  if (!cameraPermission.granted || !locationPermission.granted) {
    return (
      <View
        style={[
          styles.permissionContainer,
          { paddingTop: Platform.OS === "web" ? 67 + insets.top : insets.top + 20 },
        ]}
      >
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera" size={48} color={Colors.light.primary} />
          </View>
          <Text style={styles.permissionTitle}>Permissions Required</Text>
          <Text style={styles.permissionDesc}>
            GPS Camera needs camera and location access to take geo-tagged photos.
          </Text>

          {!cameraPermission.granted &&
            (cameraDeniedPermanently && Platform.OS !== "web" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.permissionButton,
                  styles.settingsButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={openSettings}
              >
                <Ionicons name="settings-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Open Settings for Camera</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.permissionButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={requestCameraPermission}
              >
                <Ionicons name="camera-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </Pressable>
            ))}

          {!locationPermission.granted &&
            (locationDeniedPermanently && Platform.OS !== "web" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.permissionButton,
                  styles.settingsButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={openSettings}
              >
                <Ionicons name="settings-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Open Settings for Location</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.permissionButton,
                  styles.locationButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={requestLocationPermission}
              >
                <Ionicons name="location-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Allow Location</Text>
              </Pressable>
            ))}
        </View>
      </View>
    );
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <FadeInView style={[styles.container, { paddingTop: topInset }]}>
      {/* ── Camera Preview (4:3 portrait ratio) ─────────────────── */}
      <View style={styles.previewWrapper}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
        />

        {/* Top overlay bar — GPS LIVE, count, flip */}
        <View style={styles.topBar}>
          <View style={styles.gpsLiveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.gpsLiveText}>GPS LIVE</Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {photoCount} {photoCount === 1 ? "photo" : "photos"}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.topButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Geo-details overlay pinned to bottom of preview */}
        <PhotoOverlay
          latitude={latitude}
          longitude={longitude}
          altitude={altitude}
          address={address}
          locationName={locationName}
          plusCode={plusCode || computePlusCode(latitude, longitude)}
          nearPlace={nearPlace}
          serialNumber={
            photos.length > 0
              ? `IMG-NEXT-${String(photos.length + 1).padStart(3, "0")}`
              : "IMG-NEXT-001"
          }
          timestamp={Date.now()}
        />
      </View>

      {/* ── Black Control Panel ───────────────────────────────────── */}
      <View style={[styles.controlPanel, { paddingBottom: bottomInset + 16 }]}>
        <View style={styles.controlsRow}>
          {/* Gallery thumbnail */}
          <Pressable
            style={({ pressed }) => [styles.galleryPreview, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => {
              if (lastCapturedUri) {
                const match = photos.find((p) => p.uri === lastCapturedUri);
                if (match) {
                  router.push(`/photo/${match.id}`);
                  return;
                }
              }
              router.navigate("/(tabs)/files");
            }}
          >
            {lastCapturedUri ? (
              <Image
                source={{ uri: lastCapturedUri }}
                style={styles.galleryThumb}
                contentFit="cover"
              />
            ) : (
              <View style={styles.galleryEmpty}>
                <Ionicons name="images-outline" size={22} color="#888" />
              </View>
            )}
          </Pressable>

          {/* Capture button */}
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              isCapturing && styles.captureButtonDisabled,
              { transform: [{ scale: pressed ? 0.93 : 1 }] },
            ]}
            onPress={capturePhoto}
            disabled={isCapturing}
            testID="capture-button"
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>

          {/* Flip camera */}
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={toggleCamera}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    flexDirection: "column",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionCard: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    elevation: 4,
  },
  permissionIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: "100%",
    marginBottom: 12,
  },
  locationButton: {
    backgroundColor: "#188038",
  },
  settingsButton: {
    backgroundColor: "#5F6368",
  },
  permissionButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  previewWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#111",
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  gpsLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34A853",
  },
  gpsLiveText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  topButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlPanel: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 48,
    width: "100%",
  },
  galleryPreview: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  galleryEmpty: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#FFF",
  },
  captureButtonDisabled: {
    borderColor: "rgba(255,255,255,0.4)",
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
});

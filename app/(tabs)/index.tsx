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
import {
  generateSerialNumber,
  generateId,
  ensurePhotosDirectory,
  getPhotosDirectory,
  incrementUploadCount,
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapturedUri, setLastCapturedUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");

  const { addPhoto, photos, uploadCount, maxGuestUploads } = usePhotos();

  useEffect(() => {
    if (photos.length > 0 && !lastCapturedUri) {
      setLastCapturedUri(photos[0].uri);
    }
  }, [photos, lastCapturedUri]);

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

    let interval: ReturnType<typeof setInterval>;

    const startLocationUpdates = async () => {
      if (!locationPermission?.granted) return;

      const updateLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const lat = loc.coords.latitude;
          const lon = loc.coords.longitude;
          const alt = loc.coords.altitude ?? 0;
          setLatitude(lat);
          setLongitude(lon);
          setAltitude(alt);
          setPlusCode(computePlusCode(lat, lon));

          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lon,
          });

          if (reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            const nameParts = [
              place.name && place.name !== place.street ? place.name : null,
              place.city || place.district,
              place.region,
              place.country,
            ].filter(Boolean);
            setLocationName(nameParts.join(", ") || "Unknown Location");

            const addrParts = [
              place.streetNumber,
              place.street,
              place.city || place.district,
              place.region,
              place.postalCode,
              place.country,
            ].filter(Boolean);
            setAddress(addrParts.join(", ") || "Unknown location");
          }
        } catch {
          setAddress("Location unavailable");
        }
      };

      await updateLocation();
      interval = setInterval(updateLocation, 5000);
    };

    startLocationUpdates();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [locationPermission?.granted]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    if (uploadCount >= maxGuestUploads) {
      Alert.alert(
        "Upload Limit Reached",
        `You have reached the maximum of ${maxGuestUploads} photos as a guest.`,
      );
      return;
    }

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

      const serialNumber = await generateSerialNumber();
      const id = generateId();
      const now = new Date();

      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.55,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const fileName = `${serialNumber}.jpg`;
      const destUri = `${getPhotosDirectory()}${fileName}`;
      await FileSystem.moveAsync({ from: compressed.uri, to: destUri });

      await incrementUploadCount();

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
        timestamp: now.getTime(),
        compressed: true,
      };

      await addPhoto(record);
      setLastCapturedUri(destUri);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Capture error:", err);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, latitude, longitude, altitude, address, locationName, plusCode, addPhoto, uploadCount, maxGuestUploads]);

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

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View
          style={[
            styles.topBar,
            { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 },
          ]}
        >
          <View style={styles.gpsLiveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.gpsLiveText}>GPS LIVE</Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {uploadCount}/{maxGuestUploads}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.topButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.liveGeoOverlay}>
          <View style={styles.liveGeoCard}>
            <View style={styles.liveGeoRow}>
              <Ionicons name="location" size={14} color={Colors.light.primary} />
              <Text style={styles.liveCoords}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
              {altitude > 0 && (
                <Text style={styles.liveAlt}> · {Math.round(altitude)}m</Text>
              )}
            </View>
            <Text style={styles.liveAddress} numberOfLines={1}>
              {locationName !== "Unknown Location" ? locationName : address}
            </Text>
          </View>
        </View>

        <View style={styles.bottomControls}>
          <View
            style={{
              paddingBottom:
                Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
              paddingTop: 20,
            }}
          >
            <View style={styles.controlsRow}>
              <Pressable style={styles.galleryPreview}>
                {lastCapturedUri ? (
                  <Image
                    source={{ uri: lastCapturedUri }}
                    style={styles.galleryThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.galleryEmpty}>
                    <Ionicons name="images-outline" size={22} color="#999" />
                  </View>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.captureButton,
                  isCapturing && styles.captureButtonDisabled,
                  { transform: [{ scale: pressed ? 0.92 : 1 }] },
                ]}
                onPress={capturePhoto}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>

              <View style={styles.placeholderButton} />
            </View>
          </View>
        </View>
      </CameraView>
      <PhotoOverlay
        latitude={latitude}
        longitude={longitude}
        altitude={altitude}
        address={address}
        locationName={locationName}
        plusCode={plusCode || computePlusCode(latitude, longitude)}
        serialNumber={photos.length > 0 ? `IMG-NEXT-${String(photos.length + 1).padStart(3, "0")}` : "IMG-NEXT-001"}
        timestamp={Date.now()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
  camera: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    backgroundColor: "rgba(0,0,0,0.5)",
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  liveGeoOverlay: {
    position: "absolute",
    bottom: 160,
    left: 16,
    right: 16,
  },
  liveGeoCard: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    padding: 14,
  },
  liveGeoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveCoords: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  liveAddress: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 20,
  },
  liveAlt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
  },
  galleryPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
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
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#FFF",
  },
  captureButtonDisabled: {
    borderColor: "rgba(255,255,255,0.5)",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
  },
  placeholderButton: {
    width: 48,
    height: 48,
  },
});

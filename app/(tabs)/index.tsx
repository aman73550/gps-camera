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
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { useAuth } from "@/contexts/AuthContext";
import { PhotoOverlay } from "@/components/PhotoOverlay";
import { LoginModal } from "@/components/LoginModal";
import { GuestLimitModal, LimitType } from "@/components/GuestLimitModal";
import { FadeInView } from "@/components/FadeInView";
import { Image } from "expo-image";
import { router } from "expo-router";
import { getCachedLocation, setCachedLocation } from "@/lib/location-cache";
import { showSignOutAlert } from "@/lib/signOutAlert";
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

const POI_PRIORITY: Record<string, number> = {
  hospital: 1, clinic: 1, doctors: 1,
  town_hall: 2, courthouse: 2, government: 2, police: 2, fire_station: 2, embassy: 2,
  school: 3, college: 3, university: 3, library: 3,
  museum: 4, monument: 4, memorial: 4, attraction: 4, viewpoint: 4,
  place_of_worship: 5, temple: 5, mosque: 5, church: 5,
  stadium: 6, cinema: 6, theatre: 6, community_centre: 6,
  bank: 7, post_office: 7,
};

async function fetchNearbyPOI(lat: number, lon: number): Promise<string> {
  if (Platform.OS === "web") return "";
  try {
    const radii = [300, 700];
    for (const radius of radii) {
      const query = `[out:json][timeout:8];(node["name"]["amenity"](around:${radius},${lat},${lon});node["name"]["tourism"](around:${radius},${lat},${lon});node["name"]["office"~"government|administrative|ngo|embassy"](around:${radius},${lat},${lon});node["name"]["historic"](around:${radius},${lat},${lon});way["name"]["amenity"~"hospital|school|college|university|stadium|courthouse|town_hall"](around:${radius},${lat},${lon}););out 10 center;`;
      const resp = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "GPSCameraApp/1.0" } }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const elements: any[] = data.elements ?? [];
      if (elements.length === 0) continue;
      elements.sort((a, b) => {
        const aType = a.tags?.amenity || a.tags?.tourism || a.tags?.office || a.tags?.historic || "";
        const bType = b.tags?.amenity || b.tags?.tourism || b.tags?.office || b.tags?.historic || "";
        return (POI_PRIORITY[aType] ?? 99) - (POI_PRIORITY[bType] ?? 99);
      });
      const best = elements[0];
      const name = best.tags?.name || best.tags?.["name:en"] || "";
      if (name) return name;
    }
  } catch {}
  return "";
}

export default function CameraTab() {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const cameraRef = useRef<CameraView>(null);
  const compositeRef = useRef<View>(null);

  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [address, setAddress] = useState("Fetching location...");
  const [locationName, setLocationName] = useState("Unknown Location");
  const [plusCode, setPlusCode] = useState("");
  const [nearPlace, setNearPlace] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  const [overlaySerial, setOverlaySerial] = useState<string | null>(null);
  const [lastCapturedUri, setLastCapturedUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on" | "auto">("off");
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const { addPhoto, photos, uploadCount, maxGuestUploads, tierLimits } = usePhotos();
  const { isLoggedIn, user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>("guest");
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
        const [reverseGeocode, poiName] = await Promise.all([
          Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }),
          fetchNearbyPOI(lat, lon),
        ]);
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

          const near = poiName || (() => {
            const rawName = place.name ?? "";
            const nearParts: string[] = [];
            if (rawName && !/^\d+$/.test(rawName) && rawName !== place.street) {
              nearParts.push(rawName);
            }
            if (place.district && place.district !== place.city) {
              nearParts.push(place.district);
            } else if (place.subregion && place.subregion !== place.region) {
              nearParts.push(place.subregion);
            }
            return nearParts.join(", ") || place.street || "";
          })();

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

    if (!isLoggedIn && uploadCount >= maxGuestUploads) {
      setLimitType("guest");
      setShowLimitModal(true);
      return;
    }

    setIsCapturing(true);

    try {
      await ensurePhotosDirectory();

      // Step 1 — fire shutter + haptic + get raw frame in parallel
      const [, photo] = await Promise.all([
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        }),
      ]);

      if (!photo) {
        setIsCapturing(false);
        return;
      }

      // Step 2 — generate serial number NOW so it can be burned into the image
      const serialNumber = await generateSerialNumber();
      const id = generateId();

      // Step 3 — freeze the live preview with the exact captured frame and show real serial
      setFrozenUri(photo.uri);
      setOverlaySerial(serialNumber);
      // wait for state to re-render with the real serial before capturing composite
      await new Promise((r) => setTimeout(r, 160));

      // Step 4 — screenshot the compositeRef (frozen frame + overlay with real serial burned in)
      let compositeUri: string = photo.uri;
      if (compositeRef.current && Platform.OS !== "web") {
        try {
          const viewShot = await import("react-native-view-shot");
          compositeUri = await viewShot.captureRef(compositeRef.current, {
            format: "jpg",
            quality: 0.95,
            result: "tmpfile",
          });
        } catch {
          compositeUri = photo.uri;
        }
      }

      // Step 5 — unfreeze and reset overlay serial
      setFrozenUri(null);
      setOverlaySerial(null);

      await new Promise<void>((resolve, reject) => {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const now = new Date();

            const useWebP = Platform.OS === "android";
            const imgFormat = useWebP
              ? ImageManipulator.SaveFormat.WEBP
              : ImageManipulator.SaveFormat.JPEG;

            // Compress the composite (stripe already burned in)
            const compressed = await ImageManipulator.manipulateAsync(
              compositeUri,
              [{ resize: { width: 1200 } }],
              { compress: 0.7, format: imgFormat },
            );

            const fileName = `${serialNumber}.${useWebP ? "webp" : "jpg"}`;
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
              note: note.trim() || undefined,
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
  }, [isCapturing, latitude, longitude, altitude, address, locationName, plusCode, nearPlace, note, addPhoto, isLoggedIn, uploadCount, maxGuestUploads]);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => {
      if (prev === "off") return "on";
      if (prev === "on") return "auto";
      return "off";
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleCamera = useCallback(() => {
    setFacing((prev) => {
      if (prev === "back") { setFlash("off"); return "front"; }
      return "back";
    });
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
                style={[styles.permissionButton, styles.settingsButton]}
                onPress={openSettings}
                android_ripple={{ color: Colors.light.rippleOnPrimary }}
              >
                <Ionicons name="settings-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Open Settings for Camera</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.permissionButton]}
                onPress={requestCameraPermission}
                android_ripple={{ color: Colors.light.rippleOnPrimary }}
              >
                <Ionicons name="camera-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </Pressable>
            ))}

          {!locationPermission.granted &&
            (locationDeniedPermanently && Platform.OS !== "web" ? (
              <Pressable
                style={[styles.permissionButton, styles.settingsButton]}
                onPress={openSettings}
                android_ripple={{ color: Colors.light.rippleOnPrimary }}
              >
                <Ionicons name="settings-outline" size={20} color="#FFF" />
                <Text style={styles.permissionButtonText}>Open Settings for Location</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.permissionButton, styles.locationButton]}
                onPress={requestLocationPermission}
                android_ripple={{ color: Colors.light.rippleOnPrimary }}
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior="height"
    >
      <FadeInView style={styles.container}>

        {/* ── Black header stripe ─────────────────────────────────── */}
        <View style={[styles.topBar, { paddingTop: topInset }]}>
            {facing === "back" ? (
              <Pressable
                style={styles.flashBtn}
                onPress={cycleFlash}
                testID="flash-button"
                android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
              >
                <Ionicons
                  name={
                    flash === "on" ? "flash" :
                    flash === "auto" ? "flash-outline" :
                    "flash-off"
                  }
                  size={22}
                  color={flash === "on" ? "#FFD600" : flash === "auto" ? "#FFF" : "rgba(255,255,255,0.6)"}
                />
                {flash === "auto" && (
                  <View style={styles.flashAutoTag}>
                    <Text style={styles.flashAutoText}>A</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <View style={styles.flashBtn} />
            )}
            <View style={styles.topRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {photoCount} {photoCount === 1 ? "photo" : "photos"}
                </Text>
              </View>
              {/* Login / Profile button */}
              <Pressable
                style={styles.authOverlayBtn}
                onPress={() => {
                  if (isLoggedIn) {
                    Alert.alert(
                      `Signed in: ${user?.phone}`,
                      user?.tier === "pro" ? "Pro — unlimited uploads." : "Standard account.",
                      [
                        {
                          text: "Sign Out",
                          style: "destructive",
                          onPress: () => showSignOutAlert(logout, () => router.navigate("/(tabs)/files")),
                        },
                        { text: "OK", style: "cancel" },
                      ],
                    );
                  } else {
                    setShowLoginModal(true);
                  }
                }}
                android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
              >
                {isLoggedIn ? (
                  <>
                    <View style={styles.authAvatarSmall}>
                      <Text style={styles.authAvatarSmallText}>
                        {user?.phone ? user.phone.replace(/\D/g, "").slice(-1) : "U"}
                      </Text>
                    </View>
                    <View style={styles.authGreenDot} />
                  </>
                ) : (
                  <>
                    <Ionicons name="person-outline" size={18} color="#FFF" />
                    <View style={styles.authLockDot}>
                      <Ionicons name="lock-closed" size={7} color="#FFF" />
                    </View>
                  </>
                )}
              </Pressable>
            </View>
          </View>

        {/* ── Camera Preview (4:3 portrait ratio) ─────────────────── */}
        <View style={styles.previewWrapper}>

          {/* compositeRef wraps only the image content — no UI controls */}
          <View ref={compositeRef} style={StyleSheet.absoluteFill} collapsable={false}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
            />
            {/* Frozen frame — shown during composite capture so overlay burns onto the actual frame */}
            {frozenUri && (
              <Image
                source={{ uri: frozenUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}
            {/* Geo overlay — inside compositeRef so it burns into the saved image */}
            <PhotoOverlay
              latitude={latitude}
              longitude={longitude}
              altitude={altitude}
              address={address}
              locationName={locationName}
              plusCode={plusCode || computePlusCode(latitude, longitude)}
              nearPlace={nearPlace}
              note={note.trim() || undefined}
              serialNumber={
                overlaySerial ??
                `NEXT${String(photos.length + 1).padStart(6, "0")}`
              }
              timestamp={Date.now()}
            />
          </View>

        </View>

        <LoginModal visible={showLoginModal} onClose={() => setShowLoginModal(false)} />
        <GuestLimitModal
          visible={showLimitModal}
          type={limitType}
          used={uploadCount}
          max={maxGuestUploads}
          dailyLimit={tierLimits.standardDailyLimit}
          monthlyLimit={tierLimits.standardMonthlyLimit}
          onLogin={() => {
            setShowLimitModal(false);
            setShowLoginModal(true);
          }}
          onDismiss={() => setShowLimitModal(false)}
        />

        {/* ── Note Input (expandable) ─────────────────────────────── */}
        {showNoteInput && (
          <View style={styles.noteInputRow}>
            <Ionicons name="folder-open-outline" size={16} color="rgba(255,230,100,0.9)" />
            <TextInput
              style={styles.noteInput}
              placeholder="Project name or note…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={note}
              onChangeText={setNote}
              maxLength={60}
              returnKeyType="done"
              autoFocus
              autoCapitalize="words"
            />
            {note.length > 0 && (
              <Pressable onPress={() => setNote("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}
          </View>
        )}

        {/* ── Black Control Panel ───────────────────────────────────── */}
        <View style={[styles.controlPanel, { paddingBottom: bottomInset + 16 }]}>
          <View style={styles.controlsRow}>
            {/* Gallery / last captured thumbnail */}
            <Pressable
              style={styles.galleryPreview}
              onPress={() => {
                if (lastCapturedUri) {
                  const match = photos.find((p) => p.uri === lastCapturedUri);
                  if (match) { router.push(`/photo/${match.id}`); return; }
                }
                router.navigate("/(tabs)/files");
              }}
              android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: false }}
            >
              {lastCapturedUri ? (
                <Image source={{ uri: lastCapturedUri }} style={styles.galleryThumb} contentFit="cover" />
              ) : (
                <View style={styles.galleryEmpty}>
                  <Ionicons name="images-outline" size={22} color="#888" />
                </View>
              )}
            </Pressable>

            {/* Capture button */}
            <Pressable
              style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
              onPress={capturePhoto}
              disabled={isCapturing}
              testID="capture-button"
              android_ripple={{ color: "rgba(0,0,0,0.15)", borderless: false }}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </Pressable>

            {/* Flip camera */}
            <Pressable
              style={styles.iconButton}
              onPress={toggleCamera}
              android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true }}
            >
              <Ionicons name="camera-reverse-outline" size={26} color="#FFF" />
            </Pressable>
          </View>

        </View>
      </FadeInView>
    </KeyboardAvoidingView>
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
    overflow: "hidden",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "#000",
    width: "100%",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authOverlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  authAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  authAvatarSmallText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  authGreenDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34C759",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  authLockDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,149,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFF",
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
  flashBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashAutoTag: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#FFD600",
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  flashAutoText: {
    color: "#000",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    lineHeight: 11,
  },
  noteInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.98)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,230,100,0.25)",
  },
  noteInput: {
    flex: 1,
    color: "#FFF",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    paddingVertical: 2,
  },
  controlPanel: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    paddingTop: 12,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
  },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  galleryPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  galleryEmpty: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#CCC",
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  iconButtonActive: {
    backgroundColor: "rgba(255,230,100,0.12)",
  },
  noteActiveDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,230,100,0.95)",
    borderWidth: 1,
    borderColor: "#000",
  },
});

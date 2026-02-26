import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { QRCodeView } from "@/components/QRCodeView";
import { PhotoOverlay } from "@/components/PhotoOverlay";
import { PhotoRecord } from "@/lib/photo-storage";
import { uploadPhoto, GUEST_LIMIT_ERROR } from "@/lib/upload";
import { captureRef } from "react-native-view-shot";

function PhotoDetailOverlay({ photo }: { photo: PhotoRecord }) {
  return (
    <PhotoOverlay
      latitude={photo.latitude}
      longitude={photo.longitude}
      altitude={photo.altitude ?? 0}
      address={photo.address}
      locationName={photo.locationName ?? photo.address}
      plusCode={photo.plusCode ?? ""}
      nearPlace={photo.nearPlace ?? ""}
      serialNumber={photo.serialNumber}
      timestamp={photo.timestamp}
    />
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { photos, removePhoto } = usePhotos();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const imageContainerRef = useRef<View>(null);
  const photo = photos.find((p) => p.id === id);

  if (!photo) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.centerContent]}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.light.textTertiary} />
          <Text style={styles.notFoundText}>Photo not found</Text>
          <Pressable style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.8 : 1 }]} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const date = new Date(photo.timestamp);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Photo",
      `Delete ${photo.serialNumber}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await removePhoto(photo.id); router.back(); } },
      ],
    );
  };

  const captureComposite = async (): Promise<string> => {
    if (Platform.OS === "web") return photo.uri;
    try {
      const uri = await captureRef(imageContainerRef, {
        format: "jpg",
        quality: 0.92,
      });
      return uri;
    } catch {
      return photo.uri;
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === "web") { Alert.alert("Share", "Sharing is not supported on web."); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const compositeUri = await captureComposite();
        await Sharing.shareAsync(compositeUri, { mimeType: "image/jpeg", dialogTitle: photo.serialNumber });
      } else {
        Alert.alert("Share", "Sharing is not available on this device.");
      }
    } catch (err: unknown) {
      Alert.alert("Share Error", err instanceof Error ? err.message : "Could not share.");
    }
  };

  const handleSaveToGallery = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow media library access to save photos to your device gallery.");
        return;
      }
      const compositeUri = await captureComposite();
      await MediaLibrary.saveToLibraryAsync(compositeUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Photo with geo overlay saved to your device gallery.");
    } catch (err: unknown) {
      Alert.alert("Save Error", err instanceof Error ? err.message : "Could not save to gallery.");
    }
  };

  const handleUpload = async () => {
    if (isUploading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUploading(true);
    setUploadStatus("Verifying…");
    try {
      await uploadPhoto(photo, (status) => setUploadStatus(status));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Upload Complete", `${photo.serialNumber} uploaded successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      if (msg === GUEST_LIMIT_ERROR) {
        Alert.alert(
          "Upload Limit Reached",
          "You have used all 20 guest uploads. Login to continue uploading without limits.",
          [{ text: "OK" }],
        );
      } else if (msg.includes("Unauthorized") || msg.includes("Mismatch")) {
        Alert.alert("Security Verification Failed", msg);
      } else {
        Alert.alert("Upload Failed", msg);
      }
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <Pressable style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => router.back()} testID="back-button">
            <Ionicons name="chevron-back" size={24} color={Colors.light.onSurface} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>{photo.serialNumber}</Text>
          <Pressable style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={handleDelete} testID="delete-button">
            <Ionicons name="trash-outline" size={22} color={Colors.light.error} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View ref={imageContainerRef} style={styles.imageContainer}>
            <Image source={{ uri: photo.uri }} style={styles.mainImage} contentFit="cover" transition={300} />
            <PhotoDetailOverlay photo={photo} />
          </View>

          {/* ── Action Buttons ─────────────────────────────── */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleShare}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="share-outline" size={22} color={Colors.light.primary} />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleSaveToGallery}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="download-outline" size={22} color={Colors.light.primary} />
              </View>
              <Text style={styles.actionLabel}>Save</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: (pressed || isUploading) ? 0.75 : 1 }]}
              onPress={handleUpload}
              disabled={isUploading}
            >
              <View style={[styles.actionIconWrap, styles.uploadIconWrap]}>
                {isUploading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
                }
              </View>
              <Text style={styles.actionLabel}>{isUploading ? uploadStatus || "…" : "Upload"}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleDelete}
            >
              <View style={[styles.actionIconWrap, styles.deleteIconWrap]}>
                <Ionicons name="trash-outline" size={22} color={Colors.light.error} />
              </View>
              <Text style={[styles.actionLabel, { color: Colors.light.error }]}>Delete</Text>
            </Pressable>
          </View>

          {/* ── Details ────────────────────────────────────── */}
          <View style={styles.detailsContainer}>
            <View style={styles.serialRow}>
              <View style={styles.serialInfo}>
                <Text style={styles.serialLabel}>Serial Number</Text>
                <Text style={styles.serialValue}>{photo.serialNumber}</Text>
              </View>
              <View style={styles.qrContainer}>
                <QRCodeView value={photo.serialNumber} size={72} />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="location" size={18} color={Colors.light.primary} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{photo.locationName ?? photo.address}</Text>
                  <Text style={styles.infoSubValue}>{photo.address}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="navigate" size={18} color={Colors.light.primary} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>GPS Coordinates</Text>
                  <Text style={styles.infoValue}>{photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}</Text>
                  {(photo.altitude ?? 0) > 0 && (
                    <Text style={styles.infoSubValue}>Altitude: {Math.round(photo.altitude ?? 0)} m</Text>
                  )}
                </View>
              </View>

              {photo.plusCode ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={Colors.light.primary} />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>Plus Code</Text>
                    <Text style={styles.infoValue}>{photo.plusCode}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="calendar" size={18} color={Colors.light.primary} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Date & Time</Text>
                  <Text style={styles.infoValue}>{dateStr}</Text>
                  <Text style={styles.infoSubValue}>{timeStr}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <MaterialCommunityIcons name="shield-check" size={18} color={Colors.light.success} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Verification Status</Text>
                  <Text style={[styles.infoValue, { color: Colors.light.success }]}>Verified & Whitelisted</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centerContent: { justifyContent: "center", alignItems: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  backButton: { backgroundColor: Colors.light.primary, borderRadius: 28, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  backButtonText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 8, backgroundColor: Colors.light.surface },
  topBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  topTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.onSurface, flex: 1, textAlign: "center" },
  scrollView: { flex: 1 },
  imageContainer: { width: SCREEN_WIDTH, aspectRatio: 3 / 4, backgroundColor: "#000" },
  mainImage: { width: "100%", height: "100%" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.outline,
  },
  actionBtn: { alignItems: "center", gap: 6, flex: 1 },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadIconWrap: { backgroundColor: Colors.light.primary },
  deleteIconWrap: { backgroundColor: "rgba(255,69,58,0.1)" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  detailsContainer: { padding: 20 },
  serialRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  serialInfo: { flex: 1 },
  serialLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  serialValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.onSurface, letterSpacing: 0.5 },
  qrContainer: { marginLeft: 16 },
  divider: { height: 1, backgroundColor: Colors.light.outline, marginVertical: 20 },
  infoSection: { gap: 20 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  infoIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.light.primaryContainer, justifyContent: "center", alignItems: "center", marginTop: 2 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.onSurface },
  infoSubValue: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
});

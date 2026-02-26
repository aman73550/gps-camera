import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Linking,
  Share,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { useAuth } from "@/contexts/AuthContext";
import { PhotoRecord } from "@/lib/photo-storage";
import { uploadPhotoBatch, GUEST_LIMIT_ERROR, DAILY_LIMIT_ERROR, MONTHLY_LIMIT_ERROR, NETWORK_ERROR, FILE_TOO_LARGE_ERROR, FORMAT_NOT_ALLOWED_ERROR } from "@/lib/upload";
import { FadeInView } from "@/components/FadeInView";
import { LoginModal } from "@/components/LoginModal";
import { GuestLimitModal, LimitType } from "@/components/GuestLimitModal";

const M3_EASING = Easing.bezier(0.4, 0, 0.2, 1);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface GridItemProps {
  item: PhotoRecord;
  isSelectMode: boolean;
  isSelected: boolean;
  onPress: (item: PhotoRecord) => void;
  onLongPress: (item: PhotoRecord) => void;
}

function PhotoGridItem({ item, isSelectMode, isSelected, onPress, onLongPress }: GridItemProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.gridItem, isSelected && styles.gridItemSelected, animStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        onPressIn={() => { scale.value = withTiming(0.94, { duration: 100, easing: M3_EASING }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: M3_EASING }); }}
        delayLongPress={350}
        testID={`photo-${item.id}`}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.gridImage}
          contentFit="cover"
          transition={150}
        />
        {!isSelectMode && (
          item.uploadedAt ? (
            <View style={styles.uploadedBadge} pointerEvents="none">
              <Ionicons name="checkmark" size={11} color="#FFF" />
            </View>
          ) : (
            <View style={styles.syncBadge} pointerEvents="none">
              <Ionicons name="cloud-outline" size={15} color="rgba(255,255,255,0.75)" />
            </View>
          )
        )}
        {isSelectMode && (
          <View style={[styles.selectionOverlay, isSelected && styles.selectionOverlayActive]}>
            <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function FilesTab() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : 49 + insets.bottom;
  const { photos, isLoading, refreshPhotos, filterPhotos, searchBySerial,
    uploadCount, maxGuestUploads, tierLimits, compressionSettings, removePhotos, isOnline, pendingCount } = usePhotos();
  const { isLoggedIn, user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>("guest");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [visibleCount, setVisibleCount] = useState(20);
  const hasScanned = useRef(false);

  const filteredPhotos = filterPhotos(searchQuery);
  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery]);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handlePress = useCallback((item: PhotoRecord) => {
    if (isSelectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: "/photo/[id]", params: { id: item.id } });
    }
  }, [isSelectMode]);

  const handleLongPress = useCallback((item: PhotoRecord) => {
    if (!isSelectMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSelectMode(true);
      setSelectedIds(new Set([item.id]));
    }
  }, [isSelectMode]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredPhotos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [filteredPhotos, selectedIds.size]);

  const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshPhotos();
    setIsRefreshing(false);
  }, [refreshPhotos]);

  const handleScan = useCallback(async () => {
    if (!cameraPermission?.granted) {
      if (cameraPermission?.status === "denied" && !cameraPermission?.canAskAgain && Platform.OS !== "web") {
        Alert.alert("Camera Permission Required", "Enable camera access in Settings.",
          [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => { try { Linking.openSettings(); } catch {} } }]);
        return;
      }
      await requestCameraPermission();
      return;
    }
    hasScanned.current = false;
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [cameraPermission, requestCameraPermission]);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    setIsScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const photo = await searchBySerial(data);
    if (photo) {
      router.push({ pathname: "/photo/[id]", params: { id: photo.id } });
    } else {
      Alert.alert("Not Found", `No photo found with serial number: ${data}`);
    }
  }, [searchBySerial]);

  const handleBatchUpload = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    if (!isOnline) {
      Alert.alert("Offline", "You're currently offline. Photos will be queued and uploaded when you reconnect.");
      return;
    }
    setIsBatchProcessing(true);
    setBatchStatus("Preparing upload…");
    try {
      const { succeeded, failed } = await uploadPhotoBatch(
        selectedPhotos,
        (current, total, status) => setBatchStatus(`${current}/${total} — ${status}`),
        isLoggedIn,
        user?.phone,
        maxGuestUploads,
        compressionSettings,
      );
      exitSelectMode();
      await refreshPhotos();
      const networkHit = failed.some((f) => f.error === NETWORK_ERROR);
      const guestLimitHit = failed.some((f) => f.error === GUEST_LIMIT_ERROR);
      const dailyLimitHit = failed.some((f) => f.error === DAILY_LIMIT_ERROR);
      const monthlyLimitHit = failed.some((f) => f.error === MONTHLY_LIMIT_ERROR);
      const fileTooLargeHit = failed.some((f) => f.error.startsWith(FILE_TOO_LARGE_ERROR));
      const formatNotAllowedHit = failed.some((f) => f.error === FORMAT_NOT_ALLOWED_ERROR);
      if (networkHit) {
        Alert.alert("Offline", `${succeeded.length > 0 ? `${succeeded.length} uploaded. ` : ""}${failed.filter(f => f.error === NETWORK_ERROR).length} photo(s) queued for when you reconnect.`);
      } else if (guestLimitHit) {
        setLimitType("guest");
        setShowLimitModal(true);
      } else if (dailyLimitHit) {
        setLimitType("daily");
        setShowLimitModal(true);
      } else if (monthlyLimitHit) {
        setLimitType("monthly");
        setShowLimitModal(true);
      } else if (fileTooLargeHit) {
        const maxMb = failed.find((f) => f.error.startsWith(FILE_TOO_LARGE_ERROR))?.error.split(":")[1] ?? "5";
        Alert.alert("File Too Large", `One or more photos exceeded the maximum upload size of ${maxMb} MB after compression.\nAsk your administrator to increase the limit or lower the image quality setting.`);
      } else if (formatNotAllowedHit) {
        Alert.alert("Format Not Allowed", "The current server setting only accepts JPEG images. Please contact your administrator.");
      } else if (failed.length === 0) {
        Alert.alert("Upload Complete", `${succeeded.length} photo${succeeded.length !== 1 ? "s" : ""} uploaded successfully.`);
      } else {
        Alert.alert("Upload Partial", `${succeeded.length} succeeded, ${failed.length} failed.\n\n${failed.map(f => `${f.serial}: ${f.error}`).join("\n")}`);
      }
    } catch (err: unknown) {
      Alert.alert("Upload Error", err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsBatchProcessing(false);
      setBatchStatus("");
    }
  }, [selectedPhotos, exitSelectMode, isLoggedIn, isOnline]);

  const handleBatchShare = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    try {
      if (Platform.OS === "web") {
        Alert.alert("Share", "Sharing is not supported on web.");
        return;
      }
      if (selectedPhotos.length === 1) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(selectedPhotos[0].uri, { mimeType: "image/jpeg" });
        } else {
          await Share.share({ url: selectedPhotos[0].uri });
        }
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(selectedPhotos[0].uri, { mimeType: "image/jpeg" });
          Alert.alert("Info", `Shared ${selectedPhotos[0].serialNumber}. Batch sharing shares one photo at a time.`);
        }
      }
      exitSelectMode();
    } catch (err: unknown) {
      Alert.alert("Share Error", err instanceof Error ? err.message : "Could not share.");
    }
  }, [selectedPhotos, exitSelectMode]);

  const handleBatchSave = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow access to save photos to your device gallery.");
        return;
      }
      setIsBatchProcessing(true);
      setBatchStatus("Saving to gallery…");
      let saved = 0;
      for (const photo of selectedPhotos) {
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
          saved++;
          setBatchStatus(`Saving ${saved}/${selectedPhotos.length}…`);
        } catch {}
      }
      exitSelectMode();
      Alert.alert("Saved", `${saved} photo${saved !== 1 ? "s" : ""} saved to your device gallery.`);
    } catch (err: unknown) {
      Alert.alert("Save Error", err instanceof Error ? err.message : "Could not save.");
    } finally {
      setIsBatchProcessing(false);
      setBatchStatus("");
    }
  }, [selectedPhotos, exitSelectMode]);

  const requestServerDeletion = useCallback(
    async (photos: typeof selectedPhotos) => {
      const uploaded = photos.filter((p) => p.uploadedAt && p.serialNumber);
      if (!uploaded.length) return;
      await Promise.allSettled(
        uploaded.map(async (p) => {
          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (user?.phone) headers["x-user-phone"] = user.phone;
            await fetch("/api/user/request-delete", {
              method: "POST",
              headers,
              body: JSON.stringify({ serialNumber: p.serialNumber }),
            });
          } catch {}
        }),
      );
    },
    [user],
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedPhotos.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const uploadedCount = selectedPhotos.filter((p) => p.uploadedAt).length;
    const msg = uploadedCount > 0
      ? `Delete ${selectedPhotos.length} photo${selectedPhotos.length !== 1 ? "s" : ""}? ${uploadedCount} uploaded photo${uploadedCount !== 1 ? "s" : ""} will be flagged for server deletion (pending admin approval).`
      : `Delete ${selectedPhotos.length} photo${selectedPhotos.length !== 1 ? "s" : ""}? This cannot be undone.`;
    Alert.alert("Delete Photos", msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsBatchProcessing(true);
          await requestServerDeletion(selectedPhotos);
          await removePhotos(selectedPhotos.map((p) => p.id));
          exitSelectMode();
          setIsBatchProcessing(false);
        },
      },
    ]);
  }, [selectedPhotos, removePhotos, exitSelectMode, requestServerDeletion]);

  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleBarCodeScanned} />
        <View style={[styles.scannerTopBar, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <Pressable style={({ pressed }) => [styles.scannerCloseBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setIsScanning(false)}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          <Text style={styles.scannerTitle}>Scan QR Code</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.scannerFrame}>
          <View style={styles.scannerCornerTL} />
          <View style={styles.scannerCornerTR} />
          <View style={styles.scannerCornerBL} />
          <View style={styles.scannerCornerBR} />
        </View>
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Point camera at a photo's QR code</Text>
        </View>
      </View>
    );
  }

  return (
    <FadeInView style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>

      {isSelectMode ? (
        <View style={styles.selectHeader}>
          <Pressable style={({ pressed }) => [styles.selectHeaderBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={exitSelectMode}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.selectCountText}>
            {selectedIds.size} selected
          </Text>
          <Pressable style={({ pressed }) => [styles.selectHeaderBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={handleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedIds.size === filteredPhotos.length ? "None" : "All"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Files</Text>
            <Text style={styles.headerSub}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
              {isLoggedIn
                ? ` · ${user?.phone ?? "Signed in"}`
                : ` · Guest ${uploadCount}/${maxGuestUploads}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
          {/* Settings button */}
          <Pressable
            style={({ pressed }) => [styles.trashBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/settings")}
            testID="settings-button"
          >
            <Ionicons name="settings-outline" size={20} color={Colors.light.textSecondary} />
          </Pressable>
          </View>
        </View>
      )}

      {!isSelectMode && (
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by serial number or location…"
              placeholderTextColor={Colors.light.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              testID="search-input"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color="#FF9500" />
          <Text style={styles.offlineBannerText}>
            Offline — {pendingCount} photo{pendingCount !== 1 ? "s" : ""} pending upload
          </Text>
        </View>
      )}

      {isBatchProcessing && (
        <View style={styles.batchProgressBar}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.batchProgressText}>{batchStatus}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={visiblePhotos}
          renderItem={({ item }) => (
            <PhotoGridItem
              item={item}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(item.id)}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
          )}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[
            styles.gridContent,
            { paddingBottom: isSelectMode
                ? tabBarHeight + 80
                : tabBarHeight + 16 },
          ]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="images-outline" size={56} color={Colors.light.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No Photos Yet</Text>
              <Text style={styles.emptyDesc}>Photos taken with GPS Camera will appear here.</Text>
            </View>
          }
          ListFooterComponent={
            visibleCount < filteredPhotos.length ? (
              <View style={styles.paginationFooter}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <Text style={styles.paginationText}>
                  Showing {visibleCount} of {filteredPhotos.length}
                </Text>
              </View>
            ) : filteredPhotos.length > 20 ? (
              <Text style={styles.paginationEnd}>All {filteredPhotos.length} photos loaded</Text>
            ) : null
          }
          onEndReached={() => {
            if (visibleCount < filteredPhotos.length) {
              setVisibleCount((prev) => Math.min(prev + 20, filteredPhotos.length));
            }
          }}
          onEndReachedThreshold={0.4}
          scrollEnabled={!!filteredPhotos.length}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
          testID="photo-grid"
        />
      )}

      {isSelectMode && (
        <View style={[styles.batchActionBar, { bottom: tabBarHeight }]}>
          <Pressable
            style={({ pressed }) => [styles.batchBtn, { opacity: (pressed || isBatchProcessing || selectedIds.size === 0) ? 0.5 : 1 }]}
            onPress={handleBatchShare}
            disabled={isBatchProcessing || selectedIds.size === 0}
          >
            <Ionicons name="share-outline" size={22} color="#FFF" />
            <Text style={styles.batchBtnText}>Share</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.batchBtn, { opacity: (pressed || isBatchProcessing || selectedIds.size === 0) ? 0.5 : 1 }]}
            onPress={handleBatchSave}
            disabled={isBatchProcessing || selectedIds.size === 0}
          >
            <Ionicons name="download-outline" size={22} color="#FFF" />
            <Text style={styles.batchBtnText}>Save</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.batchBtn, styles.batchBtnDelete, { opacity: (pressed || isBatchProcessing || selectedIds.size === 0) ? 0.5 : 1 }]}
            onPress={handleBatchDelete}
            disabled={isBatchProcessing || selectedIds.size === 0}
          >
            <Ionicons name="trash-outline" size={22} color="#FF453A" />
            <Text style={[styles.batchBtnText, { color: "#FF453A" }]}>Delete</Text>
          </Pressable>
        </View>
      )}

      {/* QR Scan FAB — bottom right, above tab bar */}
      {!isSelectMode && (
        <Pressable
          style={({ pressed }) => [
            styles.qrFab,
            {
              bottom: Platform.OS === "web"
                ? 84 + 20
                : insets.bottom + 50 + 20,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          onPress={handleScan}
          testID="qr-fab"
        >
          <MaterialCommunityIcons name="qrcode-scan" size={26} color="#FFF" />
        </Pressable>
      )}

      {/* Modals */}
      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
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
    </FadeInView>
  );
}

const cornerSize = 24;
const cornerBorder = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,149,0,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,149,0,0.3)",
  },
  offlineBannerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#FF9500",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  qrFab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    zIndex: 99,
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.outline,
  },
  selectHeaderBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 60 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.primary },
  selectCountText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.onSurface },
  selectAllText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.primary, textAlign: "right" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: 28,
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.onSurface,
    height: 42,
  },
  batchProgressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  batchProgressText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
    flex: 1,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  gridContent: { paddingHorizontal: GRID_GAP, paddingTop: GRID_GAP },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 3, overflow: "hidden" },
  gridItemSelected: { opacity: 0.75 },
  gridImage: { width: "100%", height: "100%" },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 6,
  },
  selectionOverlayActive: { backgroundColor: "rgba(0,100,255,0.12)" },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#FFF",
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkCircleActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  syncBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadedBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  paginationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  paginationText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  paginationEnd: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    paddingVertical: 14,
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.light.surfaceVariant, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.light.onSurface, marginBottom: 8 },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
  batchActionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.outline,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  batchBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    gap: 4,
    minWidth: 72,
  },
  batchBtnDelete: { backgroundColor: "rgba(255,69,58,0.1)" },
  batchBtnText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  scannerCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  scannerTitle: { color: "#FFF", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scannerFrame: { position: "absolute", top: "35%", left: "20%", width: "60%", height: "30%" },
  scannerCornerTL: { position: "absolute", top: 0, left: 0, width: cornerSize, height: cornerSize, borderTopWidth: cornerBorder, borderLeftWidth: cornerBorder, borderColor: "#FFF", borderTopLeftRadius: 8 },
  scannerCornerTR: { position: "absolute", top: 0, right: 0, width: cornerSize, height: cornerSize, borderTopWidth: cornerBorder, borderRightWidth: cornerBorder, borderColor: "#FFF", borderTopRightRadius: 8 },
  scannerCornerBL: { position: "absolute", bottom: 0, left: 0, width: cornerSize, height: cornerSize, borderBottomWidth: cornerBorder, borderLeftWidth: cornerBorder, borderColor: "#FFF", borderBottomLeftRadius: 8 },
  scannerCornerBR: { position: "absolute", bottom: 0, right: 0, width: cornerSize, height: cornerSize, borderBottomWidth: cornerBorder, borderRightWidth: cornerBorder, borderColor: "#FFF", borderBottomRightRadius: 8 },
  scannerHint: { position: "absolute", bottom: "15%", left: 0, right: 0, alignItems: "center" },
  scannerHintText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
});

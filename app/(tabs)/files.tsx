import React, { useState, useCallback, useRef } from "react";
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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { PhotoRecord } from "@/lib/photo-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

function PhotoGridItem({ item }: { item: PhotoRecord }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gridItem,
        { opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/photo/[id]",
          params: { id: item.id },
        });
      }}
      testID={`photo-${item.id}`}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.gridImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.gridSerialBadge}>
        <Text style={styles.gridSerialText} numberOfLines={1}>
          {item.serialNumber}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FilesTab() {
  const insets = useSafeAreaInsets();
  const { photos, isLoading, refreshPhotos, filterPhotos, searchBySerial, uploadCount, maxGuestUploads } =
    usePhotos();

  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasScanned = useRef(false);

  const filteredPhotos = filterPhotos(searchQuery);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshPhotos();
    setIsRefreshing(false);
  }, [refreshPhotos]);

  const handleScan = useCallback(async () => {
    if (!cameraPermission?.granted) {
      if (
        cameraPermission?.status === "denied" &&
        !cameraPermission?.canAskAgain &&
        Platform.OS !== "web"
      ) {
        Alert.alert(
          "Camera Permission Required",
          "Camera access was denied. Please enable it in Settings to scan QR codes.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                try {
                  Linking.openSettings();
                } catch {}
              },
            },
          ],
        );
        return;
      }
      await requestCameraPermission();
      return;
    }
    hasScanned.current = false;
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [cameraPermission, requestCameraPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (hasScanned.current) return;
      hasScanned.current = true;
      setIsScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const photo = await searchBySerial(data);
      if (photo) {
        router.push({
          pathname: "/photo/[id]",
          params: { id: photo.id },
        });
      } else {
        Alert.alert(
          "Not Found",
          `No photo found with serial number: ${data}`,
        );
      }
    },
    [searchBySerial],
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="images-outline" size={56} color={Colors.light.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Photos Yet</Text>
      <Text style={styles.emptyDesc}>
        Photos you take with GPS Camera will appear here.
      </Text>
    </View>
  );

  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        <View style={[styles.scannerTopBar, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.scannerCloseBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => setIsScanning(false)}
          >
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
          <Text style={styles.scannerHintText}>
            Point camera at a photo's QR code
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Files</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons
            name="search"
            size={18}
            color={Colors.light.textTertiary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by serial number..."
            placeholderTextColor={Colors.light.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            testID="search-input"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.light.textTertiary}
              />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleScan}
          testID="scan-button"
        >
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={22}
            color={Colors.light.primary}
          />
        </Pressable>
      </View>

      <View style={styles.uploadInfo}>
        <Ionicons name="cloud-upload-outline" size={14} color={Colors.light.textSecondary} />
        <Text style={styles.uploadInfoText}>
          Guest: {uploadCount}/{maxGuestUploads} uploads used
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          renderItem={({ item }) => <PhotoGridItem item={item} />}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[
            styles.gridContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 },
          ]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={renderEmpty}
          scrollEnabled={!!filteredPhotos.length}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.light.primary}
            />
          }
          testID="photo-grid"
        />
      )}
    </View>
  );
}

const cornerSize = 24;
const cornerBorder = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface,
  },
  headerBadge: {
    backgroundColor: Colors.light.primaryContainer,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: 28,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.onSurface,
    height: 44,
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  uploadInfoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  gridContent: {
    paddingHorizontal: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 4,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridSerialBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  gridSerialText: {
    color: "#FFF",
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onSurface,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scannerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerTitle: {
    color: "#FFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  scannerFrame: {
    position: "absolute",
    top: "35%",
    left: "20%",
    width: "60%",
    height: "30%",
  },
  scannerCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: cornerSize,
    height: cornerSize,
    borderTopWidth: cornerBorder,
    borderLeftWidth: cornerBorder,
    borderColor: "#FFF",
    borderTopLeftRadius: 8,
  },
  scannerCornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: cornerSize,
    height: cornerSize,
    borderTopWidth: cornerBorder,
    borderRightWidth: cornerBorder,
    borderColor: "#FFF",
    borderTopRightRadius: 8,
  },
  scannerCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: cornerSize,
    height: cornerSize,
    borderBottomWidth: cornerBorder,
    borderLeftWidth: cornerBorder,
    borderColor: "#FFF",
    borderBottomLeftRadius: 8,
  },
  scannerCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: cornerSize,
    height: cornerSize,
    borderBottomWidth: cornerBorder,
    borderRightWidth: cornerBorder,
    borderColor: "#FFF",
    borderBottomRightRadius: 8,
  },
  scannerHint: {
    position: "absolute",
    bottom: "15%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scannerHintText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});

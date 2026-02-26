import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";
import { PhotoRecord } from "@/lib/photo-storage";

const TRASH_DAYS = 7;

function daysUntilExpiry(deletedAt: number): number {
  const msLeft = deletedAt + TRASH_DAYS * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

function TrashItem({
  item,
  onRestore,
  onDelete,
}: {
  item: PhotoRecord;
  onRestore: (item: PhotoRecord) => void;
  onDelete: (item: PhotoRecord) => void;
}) {
  const daysLeft = item.deletedAt ? daysUntilExpiry(item.deletedAt) : TRASH_DAYS;
  const deletedDate = item.deletedAt
    ? new Date(item.deletedAt).toLocaleDateString()
    : "";

  return (
    <View style={trashStyles.item}>
      <Image
        source={{ uri: item.uri }}
        style={trashStyles.thumb}
        contentFit="cover"
        transition={150}
      />
      <View style={trashStyles.itemInfo}>
        <Text style={trashStyles.itemSerial} numberOfLines={1}>{item.serialNumber}</Text>
        <Text style={trashStyles.itemAddr} numberOfLines={1}>{item.address || "No address"}</Text>
        <Text style={trashStyles.itemDate}>Deleted {deletedDate}</Text>
        <Text style={[trashStyles.itemExpiry, daysLeft <= 1 && trashStyles.itemExpiryUrgent]}>
          {daysLeft === 0 ? "Expires today" : `Auto-deletes in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
        </Text>
      </View>
      <View style={trashStyles.itemActions}>
        <Pressable
          style={({ pressed }) => [trashStyles.restoreBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => onRestore(item)}
        >
          <Ionicons name="arrow-undo-outline" size={16} color={Colors.light.primary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [trashStyles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => onDelete(item)}
        >
          <Ionicons name="trash" size={16} color="#D32F2F" />
        </Pressable>
      </View>
    </View>
  );
}

export default function TrashScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { trashPhotos, restoreFromTrash, permanentlyDelete, emptyTrash } = usePhotos();

  const handleRestore = useCallback(
    async (item: PhotoRecord) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restoreFromTrash(item.id);
    },
    [restoreFromTrash],
  );

  const handleDelete = useCallback(
    (item: PhotoRecord) => {
      Alert.alert(
        "Delete Forever?",
        `"${item.serialNumber}" will be permanently deleted and cannot be recovered.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await permanentlyDelete(item.id);
            },
          },
        ],
      );
    },
    [permanentlyDelete],
  );

  const handleEmptyTrash = useCallback(() => {
    if (trashPhotos.length === 0) return;
    Alert.alert(
      "Empty Trash?",
      `${trashPhotos.length} photo${trashPhotos.length !== 1 ? "s" : ""} will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await emptyTrash();
            navigation.goBack();
          },
        },
      ],
    );
  }, [trashPhotos, emptyTrash, navigation]);

  return (
    <View style={[trashStyles.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      {trashPhotos.length > 0 && (
        <View style={trashStyles.infoBar}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.light.textSecondary} />
          <Text style={trashStyles.infoText}>
            Photos are permanently deleted after {TRASH_DAYS} days
          </Text>
          <Pressable
            style={({ pressed }) => [trashStyles.emptyBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleEmptyTrash}
          >
            <Text style={trashStyles.emptyBtnText}>Empty</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={trashPhotos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrashItem item={item} onRestore={handleRestore} onDelete={handleDelete} />
        )}
        contentContainerStyle={[
          trashStyles.listContent,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 },
        ]}
        ListEmptyComponent={
          <View style={trashStyles.empty}>
            <Ionicons name="trash-outline" size={64} color={Colors.light.textTertiary} />
            <Text style={trashStyles.emptyTitle}>Recycle Bin is Empty</Text>
            <Text style={trashStyles.emptyDesc}>
              Deleted photos will appear here for {TRASH_DAYS} days before being permanently removed.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const trashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  emptyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FFEBEE",
  },
  emptyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#D32F2F",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.surfaceDim,
  },
  thumb: {
    width: 80,
    height: 80,
  },
  itemInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  itemSerial: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onSurface,
  },
  itemAddr: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  itemDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  itemExpiry: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  itemExpiryUrgent: {
    color: "#D32F2F",
  },
  itemActions: {
    flexDirection: "column",
    gap: 8,
    paddingRight: 12,
    paddingVertical: 10,
  },
  restoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onSurface,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

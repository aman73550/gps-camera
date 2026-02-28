import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotos } from "@/contexts/PhotoContext";
import type { MergeProgress } from "@/lib/merge";
import Colors from "@/constants/colors";

type Phase = "prompt" | "merging" | "done" | "declined";

export function SyncPromptModal() {
  const { syncPromptVisible, syncPhotoCount, acceptSync, declineSync } = useAuth();
  const { compressionSettings, refreshPhotos } = usePhotos();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("prompt");
  const [progress, setProgress] = useState<MergeProgress | null>(null);
  const [mergeResult, setMergeResult] = useState<{
    total: number; claimed: number; uploaded: number; linked: number; failed: number;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (syncPromptVisible) {
      setPhase("prompt");
      setProgress(null);
      setMergeResult(null);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [syncPromptVisible]);

  const handleAccept = async () => {
    setPhase("merging");

    const result = await acceptSync(compressionSettings, (p) => {
      setProgress(p);
    });

    setMergeResult(result);
    setPhase("done");
    await refreshPhotos();
  };

  const handleDecline = () => {
    setPhase("declined");
    setTimeout(() => {
      declineSync();
    }, 900);
  };

  const handleDismiss = () => {
    declineSync();
  };

  if (!syncPromptVisible) return null;

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <Modal transparent animationType="none" visible={syncPromptVisible} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, paddingTop: topPad }]}>
        <View style={styles.card}>
          {phase === "prompt" && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="cloud-upload-outline" size={44} color={Colors.light.primary} />
              </View>
              <Text style={styles.title}>Merge Guest Activity?</Text>
              <Text style={styles.body}>
                You captured{" "}
                <Text style={styles.bold}>{syncPhotoCount} photo{syncPhotoCount !== 1 ? "s" : ""}</Text>{" "}
                as a guest. Would you like to merge your guest activity and uploads with your account?
              </Text>
              <Text style={styles.hint}>
                If you decline, your photos remain on this device and are still visible in the app.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.declineBtn]}
                  onPress={handleDecline}
                  android_ripple={{ color: Colors.light.rippleNeutral }}
                >
                  <Text style={styles.declineTxt}>Keep Separate</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.acceptBtn]}
                  onPress={handleAccept}
                  android_ripple={{ color: Colors.light.rippleOnPrimary }}
                >
                  <Ionicons name="cloud-upload" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.acceptTxt}>Merge</Text>
                </Pressable>
              </View>
            </>
          )}

          {phase === "merging" && (
            <>
              <View style={styles.iconWrap}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
              </View>
              <Text style={styles.title}>Merging…</Text>
              {progress && (
                <>
                  <Text style={styles.body}>{progress.message}</Text>
                  {progress.total > 0 && (
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round((progress.current / progress.total) * 100)}%` },
                        ]}
                      />
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {phase === "done" && mergeResult && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              </View>
              <Text style={styles.title}>Merge Complete</Text>
              <Text style={styles.body}>
                {mergeResult.total} photo{mergeResult.total !== 1 ? "s" : ""} processed
                {mergeResult.claimed > 0 ? ` · ${mergeResult.claimed} claimed` : ""}
                {mergeResult.uploaded > 0 ? ` · ${mergeResult.uploaded} uploaded` : ""}
                {mergeResult.linked > 0 ? ` · ${mergeResult.linked} linked` : ""}
                {mergeResult.failed > 0 ? ` · ${mergeResult.failed} failed` : ""}
              </Text>
              <Pressable
                style={[styles.btn, styles.acceptBtn, { alignSelf: "center", marginTop: 16 }]}
                onPress={handleDismiss}
                android_ripple={{ color: Colors.light.rippleOnPrimary }}
              >
                <Text style={styles.acceptTxt}>Done</Text>
              </Pressable>
            </>
          )}

          {phase === "declined" && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="phone-portrait-outline" size={44} color={Colors.light.primary} />
              </View>
              <Text style={styles.title}>Kept on Device</Text>
              <Text style={styles.body}>
                Your guest photos remain visible in the app on this device.
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#444",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
    color: "#1a1a1a",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#888",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  acceptBtn: {
    backgroundColor: Colors.light.primary,
  },
  declineBtn: {
    backgroundColor: "#f0f0f0",
  },
  acceptTxt: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  declineTxt: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
  },
  pressed: {
    opacity: 0.78,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e8e8e8",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
  },
});

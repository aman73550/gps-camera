import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface Props {
  visible: boolean;
  used: number;
  max: number;
  onLogin: () => void;
  onDismiss: () => void;
}

export function GuestLimitModal({ visible, used, max, onLogin, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-upload-outline" size={36} color="#FF9500" />
            </View>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color="#FFF" />
            </View>
          </View>

          <Text style={styles.title}>Upload Limit Reached</Text>
          <Text style={styles.desc}>
            You've used all{" "}
            <Text style={styles.highlight}>{max} free guest uploads</Text>.
            {"\n"}Sign in to upload without any limits.
          </Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((used / max) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {used}/{max} uploads used
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            onPress={onLogin}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.loginBtnText}>Sign In for Unlimited Access</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.laterBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={onDismiss}
          >
            <Text style={styles.laterText}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FAFAFA",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  iconWrap: {
    position: "relative",
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  lockBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF9500",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FAFAFA",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface,
    textAlign: "center",
    marginBottom: 10,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  highlight: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onSurface,
  },
  progressWrap: {
    width: "100%",
    marginBottom: 24,
    alignItems: "center",
    gap: 6,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textTertiary,
  },
  loginBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginBottom: 8,
  },
  loginBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  laterBtn: {
    paddingVertical: 10,
  },
  laterText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
});

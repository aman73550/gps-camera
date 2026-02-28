import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export type LimitType = "guest" | "daily" | "monthly";

interface Props {
  visible: boolean;
  type: LimitType;
  used?: number;
  max?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  onLogin: () => void;
  onDismiss: () => void;
}

function getLimitContent(type: LimitType, dailyLimit = 50, monthlyLimit = 1000) {
  switch (type) {
    case "daily":
      return {
        icon: "time-outline" as const,
        iconColor: "#007AFF",
        iconBg: "#E3F0FF",
        title: "Daily Limit Reached",
        desc: `Standard accounts can upload ${dailyLimit} photos per day.\nSign in with a Pro account for unlimited daily uploads.`,
        btnText: "Sign In / Upgrade to Pro",
        btnIcon: "star-outline" as const,
      };
    case "monthly":
      return {
        icon: "calendar-outline" as const,
        iconColor: "#AF52DE",
        iconBg: "#F3E8FF",
        title: "Monthly Limit Reached",
        desc: `Standard accounts can upload ${monthlyLimit.toLocaleString()} photos per month.\nSign in with a Pro account for unlimited uploads.`,
        btnText: "Sign In / Upgrade to Pro",
        btnIcon: "star-outline" as const,
      };
    default:
      return {
        icon: "cloud-upload-outline" as const,
        iconColor: "#FF9500",
        iconBg: "#FFF3E0",
        title: "Upload Limit Reached",
        desc: "You've used all your free guest uploads.\nSign in to get unlimited access.",
        btnText: "Sign In for Unlimited Access",
        btnIcon: "log-in-outline" as const,
      };
  }
}

export function GuestLimitModal({ visible, type, used, max, dailyLimit, monthlyLimit, onLogin, onDismiss }: Props) {
  const content = getLimitContent(type, dailyLimit, monthlyLimit);
  const showProgress = type === "guest" && used !== undefined && max !== undefined;

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
            <View style={[styles.iconCircle, { backgroundColor: content.iconBg }]}>
              <Ionicons name={content.icon} size={36} color={content.iconColor} />
            </View>
            <View style={[styles.lockBadge, { backgroundColor: content.iconColor }]}>
              <Ionicons name="lock-closed" size={12} color="#FFF" />
            </View>
          </View>

          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.desc}>{content.desc}</Text>

          {showProgress && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(((used ?? 0) / (max ?? 1)) * 100, 100)}%`,
                      backgroundColor: content.iconColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {used}/{max} uploads used
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.loginBtn, { backgroundColor: content.iconColor }]}
            onPress={onLogin}
            android_ripple={{ color: Colors.light.rippleOnPrimary }}
          >
            <Ionicons name={content.btnIcon} size={20} color="#FFF" />
            <Text style={styles.loginBtnText}>{content.btnText}</Text>
          </Pressable>

          <Pressable
            style={styles.laterBtn}
            onPress={onDismiss}
            android_ripple={{ color: Colors.light.rippleNeutral }}
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
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textTertiary,
  },
  loginBtn: {
    borderRadius: 20,
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

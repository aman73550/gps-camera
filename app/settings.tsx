import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/LoginModal";

const APP_VERSION = "1.0.0";
const PRIVACY_POLICY_URL = "https://gpscamera.app/privacy";
const TERMS_URL = "https://gpscamera.app/terms";

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed && onPress ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? "#FF453A" : Colors.light.primary} />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={Colors.light.textTertiary} />
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { isLoggedIn, user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openUrl = async (url: string, label: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Cannot Open", `Could not open ${label}. URL: ${url}`);
    }
  };

  const handleAccountPress = () => {
    if (isLoggedIn) {
      Alert.alert(
        `Signed in as ${user?.phone}`,
        user?.tier === "pro" ? "Pro account — unlimited uploads." : "Standard account.",
        [
          { text: "Sign Out", style: "destructive", onPress: logout },
          { text: "OK", style: "cancel" },
        ],
      );
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <FadeInView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleAccountPress}
          >
            <View style={[styles.rowIcon, isLoggedIn && styles.rowIconAccount]}>
              {isLoggedIn ? (
                <Text style={styles.avatarText}>
                  {user?.phone ? user.phone.replace(/\D/g, "").slice(-1) : "U"}
                </Text>
              ) : (
                <Ionicons name="person-outline" size={18} color={Colors.light.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {isLoggedIn ? (user?.phone ?? "Signed In") : "Sign In / Register"}
              </Text>
              {isLoggedIn && (
                <Text style={styles.rowSub}>
                  {user?.tier === "pro" ? "Pro" : "Standard"} · Tap to sign out
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.light.textTertiary} />
          </Pressable>
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingsRow
            icon="trash-outline"
            label="Recycle Bin"
            onPress={() => router.push("/trash")}
          />
        </View>

        {/* App Info */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow icon="camera" label="App Name" value="Verified GPS Camera" />
          <View style={styles.divider} />
          <SettingsRow icon="code-slash-outline" label="Version" value={APP_VERSION} />
        </View>

        {/* Legal */}
        <SectionHeader title="Legal" />
        <View style={styles.card}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => openUrl(PRIVACY_POLICY_URL, "Privacy Policy")}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => openUrl(TERMS_URL, "Terms of Service")}
          />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingsRow
            icon="mail-outline"
            label="Contact Support"
            onPress={() => openUrl("mailto:support@gpscamera.app", "email")}
          />
        </View>
      </ScrollView>

      <LoginModal visible={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  rowIconDestructive: {
    backgroundColor: "rgba(255,69,58,0.12)",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.onSurface,
  },
  rowLabelDestructive: {
    color: "#FF453A",
  },
  rowIconAccount: {
    backgroundColor: Colors.light.primary,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.outline,
    marginLeft: 60,
  },
});

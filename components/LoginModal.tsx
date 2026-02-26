import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "IN" },
  { code: "+1",  flag: "🇺🇸", label: "US" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+61", flag: "🇦🇺", label: "AU" },
  { code: "+86", flag: "🇨🇳", label: "CN" },
  { code: "+49", flag: "🇩🇪", label: "DE" },
  { code: "+33", flag: "🇫🇷", label: "FR" },
  { code: "+81", flag: "🇯🇵", label: "JP" },
  { code: "+55", flag: "🇧🇷", label: "BR" },
  { code: "+27", flag: "🇿🇦", label: "ZA" },
  { code: "+92", flag: "🇵🇰", label: "PK" },
  { code: "+880", flag: "🇧🇩", label: "BD" },
  { code: "+971", flag: "🇦🇪", label: "AE" },
  { code: "+966", flag: "🇸🇦", label: "SA" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LoginModal({ visible, onClose }: Props) {
  const { login, user, tier } = useAuth();
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (phone.trim().length < 5) return;
    setError("");
    setIsLoading(true);
    try {
      const fullNumber = `${countryCode.code}${phone.trim()}`;
      await login(fullNumber);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setPhone("");
        onClose();
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setPhone("");
    setSuccess(false);
    setShowPicker(false);
    onClose();
  };

  const TIER_LABEL: Record<string, string> = {
    pro: "⭐ Pro — Unlimited uploads",
    standard: "👤 Standard — 50/day · 1,000/month",
    guest: "🚶 Guest — 20 total",
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>

            {/* Success state */}
            {success ? (
              <View style={styles.successWrap}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark" size={40} color="#FFF" />
                </View>
                <Text style={styles.successTitle}>Signed In!</Text>
                <Text style={styles.successSub}>
                  {TIER_LABEL[user?.tier ?? tier] || TIER_LABEL.standard}
                </Text>
              </View>
            ) : (
              <>
                {/* Icon */}
                <View style={styles.iconWrap}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="phone-portrait-outline" size={36} color={Colors.light.primary} />
                  </View>
                </View>

                <Text style={styles.title}>Enter Mobile Number</Text>
                <Text style={styles.subtitle}>
                  Sign in to unlock higher upload limits and sync your photos
                </Text>

                {!!error && (
                  <View style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={16} color="#D32F2F" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Phone input row */}
                <View style={styles.phoneRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.countryBtn,
                      showPicker && styles.countryBtnActive,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => setShowPicker((p) => !p)}
                  >
                    <Text style={styles.flagText}>{countryCode.flag}</Text>
                    <Text style={styles.codeText}>{countryCode.code}</Text>
                    <Ionicons
                      name={showPicker ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={Colors.light.textSecondary}
                    />
                  </Pressable>

                  <TextInput
                    ref={inputRef}
                    style={styles.phoneInput}
                    placeholder="Mobile number"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/[^\d\s\-]/g, ""));
                      setError("");
                    }}
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.light.textTertiary}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    maxLength={15}
                    autoFocus
                  />
                </View>

                {/* Country picker dropdown */}
                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    {COUNTRY_CODES.map((cc) => (
                      <Pressable
                        key={cc.code + cc.label}
                        style={({ pressed }) => [
                          styles.pickerItem,
                          cc.code === countryCode.code && styles.pickerItemActive,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                        onPress={() => {
                          setCountryCode(cc);
                          setShowPicker(false);
                          inputRef.current?.focus();
                        }}
                      >
                        <Text style={styles.flagText}>{cc.flag}</Text>
                        <Text style={styles.pickerLabel}>{cc.label}</Text>
                        <Text style={styles.pickerCode}>{cc.code}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Tier info */}
                <View style={styles.tierRow}>
                  <View style={styles.tierItem}>
                    <Ionicons name="person" size={13} color={Colors.light.primary} />
                    <Text style={styles.tierText}>Standard: 50/day</Text>
                  </View>
                  <View style={styles.tierDivider} />
                  <View style={styles.tierItem}>
                    <Ionicons name="star" size={13} color="#7B1FA2" />
                    <Text style={[styles.tierText, { color: "#7B1FA2" }]}>Pro: Unlimited</Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.loginBtn,
                    { opacity: pressed || isLoading || phone.length < 5 ? 0.65 : 1 },
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading || phone.length < 5}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={20} color="#FFF" />
                      <Text style={styles.loginBtnText}>Sign In</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.guestBtn, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={handleClose}
                >
                  <Text style={styles.guestText}>Continue as Guest (20 uploads)</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  kav: { width: "100%" },
  sheet: {
    backgroundColor: "#FAFAFA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#DEDEDE",
    alignSelf: "center", marginBottom: 12,
  },
  closeBtn: {
    position: "absolute", top: 18, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: "center", alignItems: "center",
  },
  successWrap: {
    alignItems: "center",
    paddingVertical: 32,
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#43A047",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold",
    color: "#1a1a1a", marginBottom: 6,
  },
  successSub: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: "#555", textAlign: "center",
  },
  iconWrap: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center", alignItems: "center",
  },
  title: {
    fontSize: 22, fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface, textAlign: "center", marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center",
    marginBottom: 18, lineHeight: 19,
  },
  errorWrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFEBEE", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  errorText: {
    color: "#D32F2F", fontSize: 13,
    fontFamily: "Inter_500Medium", flex: 1,
  },
  phoneRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 10,
  },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFF", borderWidth: 1.5,
    borderColor: Colors.light.outline, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 14, minWidth: 90,
  },
  countryBtnActive: { borderColor: Colors.light.primary },
  flagText: { fontSize: 18, lineHeight: 22 },
  codeText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: Colors.light.onSurface, flex: 1,
  },
  phoneInput: {
    flex: 1, backgroundColor: "#FFF",
    borderWidth: 1.5, borderColor: Colors.light.outline,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: Colors.light.onSurface,
  },
  pickerDropdown: {
    backgroundColor: "#FFF", borderWidth: 1.5,
    borderColor: Colors.light.outline, borderRadius: 14,
    marginBottom: 10, maxHeight: 180, overflow: "scroll" as any,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.outline,
  },
  pickerItemActive: { backgroundColor: Colors.light.primaryContainer },
  pickerLabel: {
    flex: 1, fontSize: 14,
    fontFamily: "Inter_500Medium", color: Colors.light.onSurface,
  },
  pickerCode: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  tierRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 14, gap: 0,
  },
  tierItem: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 5, justifyContent: "center",
  },
  tierDivider: {
    width: 1, height: 14, backgroundColor: Colors.light.outline,
  },
  tierText: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  loginBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 16,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 8, marginBottom: 6,
  },
  loginBtnText: {
    color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold",
  },
  guestBtn: {
    alignItems: "center", paddingVertical: 12,
  },
  guestText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
});

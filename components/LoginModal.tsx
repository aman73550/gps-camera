import React, { useState, useRef, useEffect } from "react";
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
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

WebBrowser.maybeCompleteAuthSession();

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
  const [showPhoneSection, setShowPhoneSection] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: googleClientId,
    iosClientId: googleClientId,
    androidClientId: googleClientId,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      handleGoogleSuccess(googleResponse.authentication?.accessToken ?? "");
    }
  }, [googleResponse]);

  const handleGoogleSuccess = async (accessToken: string) => {
    if (!accessToken) { setError("Google sign-in failed. Please try again."); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://www.googleapis.com/userinfo/v2/me?access_token=${accessToken}`
      );
      const info = await res.json();
      if (!info.email) throw new Error("Could not get email from Google.");
      await login(info.email, info.name ?? info.given_name ?? undefined);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identifier = credential.email ?? `apple_${credential.user}`;
      const name = credential.fullName?.givenName
        ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ""}`.trim()
        : undefined;
      await login(identifier, name);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1400);
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        setError(e instanceof Error ? e.message : "Apple sign-in failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (phone.trim().length < 5) return;
    setError("");
    setIsLoading(true);
    try {
      const fullNumber = `${countryCode.code}${phone.trim()}`;
      await login(fullNumber);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setPhone(""); onClose(); }, 1400);
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
    setShowPhoneSection(false);
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
                <View style={styles.iconWrap}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="shield-checkmark-outline" size={36} color={Colors.light.primary} />
                  </View>
                </View>

                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>
                  Unlock higher upload limits and sync your photos
                </Text>

                {!!error && (
                  <View style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={16} color="#D32F2F" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Social sign-in buttons */}
                <View style={styles.socialSection}>
                  {/* Google */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.socialBtn,
                      !googleClientId && styles.socialBtnDisabled,
                      { opacity: (pressed || isLoading || !googleClientId) ? 0.6 : 1 },
                    ]}
                    onPress={() => promptGoogleAsync()}
                    disabled={isLoading || !googleClientId}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#444" />
                    ) : (
                      <Text style={styles.googleG}>G</Text>
                    )}
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </Pressable>

                  {/* Apple — iOS only */}
                  {Platform.OS === "ios" && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.socialBtn,
                        styles.appleBtn,
                        { opacity: (pressed || isLoading) ? 0.75 : 1 },
                      ]}
                      onPress={handleAppleLogin}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Ionicons name="logo-apple" size={20} color="#FFF" />
                      )}
                      <Text style={[styles.socialBtnText, { color: "#FFF" }]}>Continue with Apple</Text>
                    </Pressable>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Phone number toggle */}
                {!showPhoneSection ? (
                  <Pressable
                    style={({ pressed }) => [styles.phoneToggleBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => { setShowPhoneSection(true); setTimeout(() => inputRef.current?.focus(), 100); }}
                  >
                    <Ionicons name="call-outline" size={17} color={Colors.light.primary} />
                    <Text style={styles.phoneToggleText}>Continue with Phone Number</Text>
                  </Pressable>
                ) : (
                  <>
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
                        onChangeText={(t) => { setPhone(t.replace(/[^\d\s\-]/g, "")); setError(""); }}
                        keyboardType="phone-pad"
                        placeholderTextColor={Colors.light.textTertiary}
                        returnKeyType="done"
                        onSubmitEditing={handlePhoneLogin}
                        maxLength={15}
                      />
                    </View>

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
                            onPress={() => { setCountryCode(cc); setShowPicker(false); inputRef.current?.focus(); }}
                          >
                            <Text style={styles.flagText}>{cc.flag}</Text>
                            <Text style={styles.pickerLabel}>{cc.label}</Text>
                            <Text style={styles.pickerCode}>{cc.code}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}

                    <Pressable
                      style={({ pressed }) => [
                        styles.loginBtn,
                        { opacity: pressed || isLoading || phone.length < 5 ? 0.65 : 1 },
                      ]}
                      onPress={handlePhoneLogin}
                      disabled={isLoading || phone.length < 5}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={20} color="#FFF" />
                          <Text style={styles.loginBtnText}>Sign In with Phone</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}

                {!googleClientId && (
                  <Text style={styles.noGoogleHint}>
                    Google sign-in requires EXPO_PUBLIC_GOOGLE_CLIENT_ID to be configured.
                  </Text>
                )}

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
  successWrap: { alignItems: "center", paddingVertical: 32 },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#43A047",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1a1a1a", marginBottom: 6 },
  successSub: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#555", textAlign: "center" },
  iconWrap: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center", alignItems: "center",
  },
  title: {
    fontSize: 22, fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface, textAlign: "center", marginBottom: 4,
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center",
    marginBottom: 16, lineHeight: 19,
  },
  errorWrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFEBEE", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  errorText: { color: "#D32F2F", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  socialSection: { gap: 10, marginBottom: 4 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderWidth: 1.5, borderColor: "#E0E0E0",
    borderRadius: 14, paddingVertical: 14,
  },
  socialBtnDisabled: { backgroundColor: "#F5F5F5", borderColor: "#E0E0E0" },
  appleBtn: { backgroundColor: "#000", borderColor: "#000" },
  googleG: {
    fontSize: 18, fontFamily: "Inter_700Bold",
    color: "#4285F4", lineHeight: 22,
  },
  socialBtnText: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    color: "#222",
  },
  dividerRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginVertical: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E0E0E0" },
  dividerText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  phoneToggleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    borderWidth: 1.5, borderColor: Colors.light.outline,
    borderRadius: 14, paddingVertical: 14,
    backgroundColor: Colors.light.primaryContainer,
    marginBottom: 4,
  },
  phoneToggleText: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFF", borderWidth: 1.5,
    borderColor: Colors.light.outline, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 14, minWidth: 90,
  },
  countryBtnActive: { borderColor: Colors.light.primary },
  flagText: { fontSize: 18, lineHeight: 22 },
  codeText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.onSurface, flex: 1 },
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
  pickerLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.onSurface },
  pickerCode: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  loginBtn: {
    backgroundColor: Colors.light.primary, borderRadius: 16,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 8, marginBottom: 6,
  },
  loginBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noGoogleHint: {
    fontSize: 11, color: Colors.light.textTertiary,
    fontFamily: "Inter_400Regular", textAlign: "center",
    marginTop: 8, lineHeight: 15,
  },
  guestBtn: { alignItems: "center", paddingVertical: 12 },
  guestText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
});

import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
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
  const { login } = useAuth();
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showPhoneSection, setShowPhoneSection] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const redirectUri = makeRedirectUri({ useProxy: true });

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: googleClientId,
    iosClientId: googleClientId,
    androidClientId: googleClientId,
    redirectUri,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      handleGoogleSuccess(googleResponse.authentication?.accessToken ?? "");
    } else if (googleResponse?.type === "error") {
      const desc = (googleResponse as any)?.error?.description ?? (googleResponse as any)?.error ?? "";
      setError(`Google sign-in failed. ${desc ? `Error: ${desc}` : `Add this URI in Google Cloud Console → Authorized redirect URIs:\n${redirectUri}`}`);
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
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
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
      setPhone("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setPhone("");
    setShowPicker(false);
    setShowPhoneSection(false);
    onClose();
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
          behavior="height"
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8} android_ripple={{ color: Colors.light.rippleNeutral, borderless: true }}>
              <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>

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
                    style={[styles.socialBtn, !googleClientId && styles.socialBtnDisabled]}
                    onPress={() => promptGoogleAsync()}
                    disabled={isLoading || !googleClientId}
                    android_ripple={{ color: Colors.light.rippleNeutral }}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#444" />
                    ) : (
                      <Text style={styles.googleG}>G</Text>
                    )}
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </Pressable>

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
                    style={styles.phoneToggleBtn}
                    onPress={() => { setShowPhoneSection(true); setTimeout(() => inputRef.current?.focus(), 100); }}
                    android_ripple={{ color: Colors.light.ripplePrimary }}
                  >
                    <Ionicons name="call-outline" size={17} color={Colors.light.primary} />
                    <Text style={styles.phoneToggleText}>Continue with Phone Number</Text>
                  </Pressable>
                ) : (
                  <>
                    <View style={styles.phoneRow}>
                      <Pressable
                        style={[styles.countryBtn, showPicker && styles.countryBtnActive]}
                        onPress={() => setShowPicker((p) => !p)}
                        android_ripple={{ color: Colors.light.rippleNeutral }}
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
                            style={[styles.pickerItem, cc.code === countryCode.code && styles.pickerItemActive]}
                            onPress={() => { setCountryCode(cc); setShowPicker(false); inputRef.current?.focus(); }}
                            android_ripple={{ color: Colors.light.rippleNeutral }}
                          >
                            <Text style={styles.flagText}>{cc.flag}</Text>
                            <Text style={styles.pickerLabel}>{cc.label}</Text>
                            <Text style={styles.pickerCode}>{cc.code}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}

                    <Pressable
                      style={[styles.loginBtn, (isLoading || phone.length < 5) && { opacity: 0.65 }]}
                      onPress={handlePhoneLogin}
                      disabled={isLoading || phone.length < 5}
                      android_ripple={{ color: Colors.light.rippleOnPrimary }}
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
                  style={styles.guestBtn}
                  onPress={handleClose}
                  android_ripple={{ color: Colors.light.rippleNeutral }}
                >
                  <Text style={styles.guestText}>Continue as Guest (20 uploads)</Text>
                </Pressable>
            </>
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
    paddingBottom: 28,
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
    overflow: "hidden",
  },
  socialBtnDisabled: { backgroundColor: "#F5F5F5", borderColor: "#E0E0E0" },
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
    overflow: "hidden",
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
    backgroundColor: Colors.light.primary, borderRadius: 20,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 8, marginBottom: 6,
    overflow: "hidden",
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

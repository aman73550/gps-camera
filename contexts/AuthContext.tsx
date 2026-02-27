import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Alert } from "react-native";
import { getUnmergedPhotos } from "@/lib/photo-storage";
import { mergeGuestActivity, MergeResult, MergeProgress } from "@/lib/merge";
import type { CompressionSettings } from "@/lib/upload";

const AUTH_KEY = "auth_user_v2";
const WARN_SEEN_KEY = "warn_seen_v1";

function getBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:5000";
}

export interface AuthUser {
  name: string;
  phone: string;
  tier: "standard" | "pro";
}

interface ProfileData {
  tier: "standard" | "pro";
  banned: boolean;
  warned: boolean;
  warnMessage: string | null;
  banReason: string | null;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  tier: "guest" | "standard" | "pro";
  isBanned: boolean;
  warnMessage: string | null;
  loginModalVisible: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (phone: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  syncPromptVisible: boolean;
  syncPhotoCount: number;
  acceptSync: (compression?: CompressionSettings, onProgress?: (p: MergeProgress) => void) => Promise<MergeResult>;
  declineSync: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiLogin(phone: string): Promise<{ phone: string; tier: "standard" | "pro" }> {
  const res = await fetch(`${getBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Login failed (${res.status})`);
  }
  return res.json();
}

async function apiGetProfile(phone: string): Promise<ProfileData> {
  const res = await fetch(`${getBase()}/api/auth/profile`, {
    headers: { "x-user-phone": phone },
  });
  if (!res.ok) throw new Error("Profile fetch failed");
  const data = await res.json();
  return {
    tier: (data.tier as "standard" | "pro") || "standard",
    banned: !!data.banned,
    warned: !!data.warned,
    warnMessage: data.warnMessage || null,
    banReason: data.banReason || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [syncPromptVisible, setSyncPromptVisible] = useState(false);
  const [syncPhotoCount, setSyncPhotoCount] = useState(0);
  const [pendingUserForSync, setPendingUserForSync] = useState<AuthUser | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [warnMessage, setWarnMessage] = useState<string | null>(null);

  const applyProfile = useCallback(async (u: AuthUser, profile: ProfileData) => {
    if (profile.banned) {
      setIsBanned(true);
      setUser(u);
      Alert.alert(
        "Account Suspended",
        `Your account has been suspended.\n\nReason: ${profile.banReason || "Policy violation"}\n\nContact support to appeal.`,
        [{ text: "OK" }],
      );
      return;
    }
    setIsBanned(false);

    if (profile.warned && profile.warnMessage) {
      const warnKey = `${WARN_SEEN_KEY}_${u.phone}`;
      const lastSeen = await AsyncStorage.getItem(warnKey).catch(() => null);
      if (lastSeen !== profile.warnMessage) {
        setWarnMessage(profile.warnMessage);
        await AsyncStorage.setItem(warnKey, profile.warnMessage).catch(() => {});
        Alert.alert(
          "Account Warning",
          profile.warnMessage,
          [{ text: "Understood", onPress: () => setWarnMessage(null) }],
        );
      }
    } else {
      setWarnMessage(null);
    }

    const updated: AuthUser = { ...u, tier: profile.tier };
    if (updated.tier !== u.tier) {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated)).catch(() => {});
    }
    setUser(updated);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then(async (v) => {
      if (!v) return;
      try {
        const parsed: AuthUser = JSON.parse(v);
        setUser(parsed);
        const profile = await apiGetProfile(parsed.phone);
        await applyProfile(parsed, profile);
      } catch {}
    });
  }, [applyProfile]);

  const login = useCallback(async (phone: string, displayName?: string) => {
    const isEmail = phone.includes("@");
    if (!isEmail) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 7) {
        throw new Error("Please enter a valid mobile number.");
      }
    }

    const result = await apiLogin(phone);

    const last4 = phone.replace(/\D/g, "").slice(-4);
    const u: AuthUser = {
      name: displayName ?? (isEmail ? phone.split("@")[0] : `User ${last4}`),
      phone: result.phone,
      tier: result.tier ?? "standard",
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setLoginModalVisible(false);

    const profile = await apiGetProfile(u.phone).catch(() => null);
    if (profile?.banned) {
      setIsBanned(true);
      setUser(u);
      Alert.alert(
        "Account Suspended",
        `Your account has been suspended.\n\nReason: ${profile.banReason || "Policy violation"}\n\nContact support to appeal.`,
        [{ text: "OK" }],
      );
      return;
    }

    const unmerged = await getUnmergedPhotos();
    if (unmerged.length > 0) {
      setPendingUserForSync(u);
      setSyncPhotoCount(unmerged.length);
      setSyncPromptVisible(true);
    } else {
      if (profile) await applyProfile(u, profile);
      else setUser(u);
    }
  }, [applyProfile]);

  const acceptSync = useCallback(
    async (
      compression?: CompressionSettings,
      onProgress?: (p: MergeProgress) => void,
    ): Promise<MergeResult> => {
      const target = pendingUserForSync;
      setSyncPromptVisible(false);
      if (target) setUser(target);
      setPendingUserForSync(null);

      if (!target) {
        return { total: 0, claimed: 0, uploaded: 0, linked: 0, failed: 0 };
      }

      return mergeGuestActivity(target.phone, compression, onProgress);
    },
    [pendingUserForSync],
  );

  const declineSync = useCallback(() => {
    const target = pendingUserForSync;
    setSyncPromptVisible(false);
    setPendingUserForSync(null);
    if (target) setUser(target);
  }, [pendingUserForSync]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
    setIsBanned(false);
    setWarnMessage(null);
    setSyncPromptVisible(false);
    setPendingUserForSync(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const target = user ?? pendingUserForSync;
    if (!target) return;
    try {
      const profile = await apiGetProfile(target.phone);
      await applyProfile(target, profile);
    } catch {}
  }, [user, pendingUserForSync, applyProfile]);

  const tier: "guest" | "standard" | "pro" = (user ?? pendingUserForSync)
    ? ((user ?? pendingUserForSync)!.tier ?? "standard")
    : "guest";

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!(user ?? pendingUserForSync),
        user: user ?? pendingUserForSync,
        tier,
        isBanned,
        warnMessage,
        loginModalVisible,
        openLoginModal: () => setLoginModalVisible(true),
        closeLoginModal: () => setLoginModalVisible(false),
        login,
        logout,
        refreshProfile,
        syncPromptVisible,
        syncPhotoCount,
        acceptSync,
        declineSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

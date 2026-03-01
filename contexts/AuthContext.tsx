import React, { createContext, useContext, ReactNode } from "react";
import type { CompressionSettings } from "@/lib/upload";
import type { MergeResult, MergeProgress } from "@/lib/merge";

export interface AuthUser {
  name: string;
  phone: string;
  tier: "standard" | "pro";
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

const noopAsync = async () => {};
const noopMerge = async (): Promise<MergeResult> => ({
  total: 0, claimed: 0, uploaded: 0, linked: 0, failed: 0,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: false,
        user: null,
        tier: "pro",
        isBanned: false,
        warnMessage: null,
        loginModalVisible: false,
        openLoginModal: () => {},
        closeLoginModal: () => {},
        login: noopAsync,
        logout: () => {},
        refreshProfile: noopAsync,
        syncPromptVisible: false,
        syncPhotoCount: 0,
        acceptSync: noopMerge,
        declineSync: () => {},
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

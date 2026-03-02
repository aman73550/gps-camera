import React, { createContext, useContext, ReactNode } from "react";

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
  login: (phone: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PRO_USER: AuthUser = { name: "User", phone: "local", tier: "pro" };

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: true,
        user: PRO_USER,
        tier: "pro",
        isBanned: false,
        warnMessage: null,
        login: async () => {},
        logout: () => {},
        refreshProfile: async () => {},
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

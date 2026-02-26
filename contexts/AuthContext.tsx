import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "auth_user";

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  loginModalVisible: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then((v) => {
      if (v) {
        try {
          setUser(JSON.parse(v));
        } catch {}
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim();
    if (!trimmed || !password.trim()) {
      throw new Error("Please enter your email and password.");
    }
    if (!trimmed.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    const u: AuthUser = {
      name: trimmed.split("@")[0],
      email: trimmed.toLowerCase(),
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
    setLoginModalVisible(false);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!user,
        user,
        loginModalVisible,
        openLoginModal: () => setLoginModalVisible(true),
        closeLoginModal: () => setLoginModalVisible(false),
        login,
        logout,
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

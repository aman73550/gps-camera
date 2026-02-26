import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { PhotoProvider } from "@/contexts/PhotoContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { checkRequiredVersion } from "@/lib/supabase";
import { cleanExpiredTrash } from "@/lib/photo-storage";
import Colors from "@/constants/colors";

const APP_VERSION = "1.0.0";
const APP_STORE_URL = "https://apps.apple.com/app/gps-camera";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.gpscamera";

type BootState = "checking" | "blocked" | "ok";

function isVersionLower(current: string, required: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [rMaj, rMin, rPat] = parse(required);
  if (cMaj !== rMaj) return cMaj < rMaj;
  if (cMin !== rMin) return cMin < rMin;
  return cPat < rPat;
}

function HardBlockScreen() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const openStore = () => {
    const url = Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={blockStyles.root}>
      <View style={blockStyles.card}>
        <View style={blockStyles.shieldWrap}>
          <Ionicons name="shield-checkmark" size={64} color={Colors.light.primary} />
        </View>
        <Text style={blockStyles.title}>Update Required</Text>
        <Text style={blockStyles.body}>
          This version of GPS Camera is no longer supported. Please update to continue using the app safely.
        </Text>
        <Text style={blockStyles.versionChip}>Your version: {APP_VERSION}</Text>
        <Pressable
          style={({ pressed }) => [blockStyles.updateBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={openStore}
        >
          <Ionicons name="download-outline" size={18} color="#FFF" />
          <Text style={blockStyles.updateBtnText}>Update Now</Text>
        </Pressable>
        <Text style={blockStyles.footer}>
          You must update to continue. The app cannot be used on this version.
        </Text>
      </View>
    </View>
  );
}


function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="photo/[id]"
        options={{
          headerShown: false,
          animation: "fade_from_bottom",
        }}
      />
      <Stack.Screen
        name="trash"
        options={{
          title: "Recycle Bin",
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [bootState, setBootState] = useState<BootState>("checking");

  useEffect(() => {
    checkRequiredVersion()
      .then(({ requiredVersion, forceUpdate }) => {
        const isBlocked =
          forceUpdate ||
          (requiredVersion !== null && isVersionLower(APP_VERSION, requiredVersion));
        setBootState(isBlocked ? "blocked" : "ok");
      })
      .catch(() => {
        setBootState("ok");
      });
  }, []);

  useEffect(() => {
    if (!fontsLoaded || bootState === "checking") return;
    SplashScreen.hideAsync();

    if (bootState === "ok") {
      cleanExpiredTrash(7).catch(() => {});
    }
  }, [fontsLoaded, bootState]);

  if (!fontsLoaded || bootState === "checking") {
    return null;
  }

  if (bootState === "blocked") {
    return <HardBlockScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PhotoProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </PhotoProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const blockStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  shieldWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  versionChip: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#888",
    backgroundColor: Colors.light.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 24,
  },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: "100%",
    marginBottom: 16,
  },
  updateBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#bbb",
    textAlign: "center",
  },
});


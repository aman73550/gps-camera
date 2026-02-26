import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { PhotoProvider } from "@/contexts/PhotoContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { checkRequiredVersion } from "@/lib/supabase";
import Colors from "@/constants/colors";

const APP_VERSION = "1.0.0";
const APP_STORE_URL = "https://apps.apple.com/app/gps-camera";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.gpscamera";

function isVersionLower(current: string, required: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [rMaj, rMin, rPat] = parse(required);
  if (cMaj !== rMaj) return cMaj < rMaj;
  if (cMin !== rMin) return cMin < rMin;
  return cPat < rPat;
}

function UpdateModal({ visible }: { visible: boolean }) {
  const openStore = () => {
    const url = Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={updateStyles.overlay}>
        <View style={updateStyles.card}>
          <View style={updateStyles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={48} color={Colors.light.primary} />
          </View>
          <Text style={updateStyles.title}>Update Required</Text>
          <Text style={updateStyles.body}>
            A newer version of GPS Camera is required to continue. Please update the app to access all features.
          </Text>
          <Text style={updateStyles.versionHint}>
            Your version: {APP_VERSION}
          </Text>
          <Pressable
            style={({ pressed }) => [updateStyles.button, { opacity: pressed ? 0.85 : 1 }]}
            onPress={openStore}
          >
            <Ionicons name="download-outline" size={18} color="#FFF" />
            <Text style={updateStyles.buttonText}>Update Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const updateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
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
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  versionHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#999",
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});

SplashScreen.preventAutoHideAsync();

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
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkRequiredVersion().then((requiredVersion) => {
        if (requiredVersion && isVersionLower(APP_VERSION, requiredVersion)) {
          setShowUpdateModal(true);
        }
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PhotoProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
                <UpdateModal visible={showUpdateModal} />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </PhotoProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

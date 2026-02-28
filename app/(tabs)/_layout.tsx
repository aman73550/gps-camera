import { Tabs } from "expo-router";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";
import { usePhotos } from "@/contexts/PhotoContext";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const { pendingCount } = usePhotos();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
        },
        tabBarStyle: {
          backgroundColor: isDark ? "#121212" : "#ffffff",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? "#333" : Colors.light.outline,
          elevation: 8,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: isWeb
          ? () => (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? "#121212" : "#ffffff" },
                ]}
              />
            )
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Camera",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "camera" : "camera-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: "Files",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.light.primary,
            fontSize: 10,
            fontFamily: "Inter_700Bold",
            minWidth: 16,
            height: 16,
            lineHeight: 14,
          },
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: "relative" }}>
              <Ionicons
                name={focused ? "folder" : "folder-outline"}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

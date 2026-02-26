import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { QRCodeView } from "./QRCodeView";

interface PhotoOverlayProps {
  latitude: number;
  longitude: number;
  address: string;
  serialNumber: string;
  timestamp: string;
}

export function PhotoOverlay({
  latitude,
  longitude,
  address,
  serialNumber,
  timestamp,
}: PhotoOverlayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.bottomRow}>
        <View style={styles.geoInfo}>
          <Text style={styles.geoText} numberOfLines={1}>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {address}
          </Text>
          <Text style={styles.timestampText}>{timestamp}</Text>
        </View>
        <View style={styles.qrSection}>
          <QRCodeView value={serialNumber || "GPS-CAMERA"} size={56} />
          <Text style={styles.serialText}>{serialNumber}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  geoInfo: {
    flex: 1,
    marginRight: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  geoText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  addressText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  timestampText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  qrSection: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    padding: 8,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

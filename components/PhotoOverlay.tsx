import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QRCodeView } from "./QRCodeView";

interface PhotoOverlayProps {
  latitude: number;
  longitude: number;
  altitude: number;
  address: string;
  locationName: string;
  plusCode: string;
  serialNumber: string;
  timestamp: number;
}

export function PhotoOverlay({
  latitude,
  longitude,
  altitude,
  address,
  locationName,
  plusCode,
  serialNumber,
  timestamp,
}: PhotoOverlayProps) {
  const date = new Date(timestamp);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const dateStr = `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${h}:${m}:${s}`;

  const coordStr = `${latitude >= 0 ? latitude.toFixed(4) + "°N" : Math.abs(latitude).toFixed(4) + "°S"}, ${longitude >= 0 ? longitude.toFixed(4) + "°E" : Math.abs(longitude).toFixed(4) + "°W"}`;

  const altStr = altitude > 0 ? `${Math.round(altitude)} m` : "— m";

  return (
    <View style={styles.container}>
      <View style={styles.overlayBox}>
        <View style={styles.leftSection}>
          <View style={styles.qrWrapper}>
            <QRCodeView
              value={serialNumber || "GPS-CAMERA"}
              size={62}
              backgroundColor="#1a1a1a"
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.serialText} numberOfLines={1}>
            {serialNumber}
          </Text>
          <Text style={styles.coordMini} numberOfLines={1}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        </View>

        <View style={styles.dividerLine} />

        <View style={styles.rightSection}>
          <Text style={styles.locationTitle} numberOfLines={2}>
            {locationName || "Unknown Location"}
          </Text>
          <Text style={styles.addressText} numberOfLines={3}>
            {address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
          </Text>
          <Text style={styles.plusCodeText}>
            Plus Code : {plusCode}
          </Text>
          <Text style={styles.dateText}>{dateStr}</Text>

          <View style={styles.bottomRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="weather-sunny" size={11} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="water-percent" size={11} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="image-filter-hdr" size={11} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>{altStr}</Text>
            </View>
          </View>
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
  overlayBox: {
    flexDirection: "row",
    backgroundColor: "rgba(18, 18, 18, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "stretch",
    gap: 10,
  },
  leftSection: {
    width: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  qrWrapper: {
    padding: 3,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  coordMini: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 6,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 1,
  },
  dividerLine: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 2,
  },
  rightSection: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
    marginBottom: 1,
  },
  addressText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    lineHeight: 13,
  },
  plusCodeText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 8.5,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  dateText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 8.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metaText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 8.5,
    fontFamily: "Inter_400Regular",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
});

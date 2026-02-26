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
  const altStr = altitude > 0 ? `${Math.round(altitude)} m` : "— m";

  return (
    <View style={styles.container}>
      <View style={styles.overlayBox}>

        {/* Left: QR + Serial */}
        <View style={styles.leftSection}>
          <View style={styles.qrWrapper}>
            <QRCodeView
              value={serialNumber || "GPS-CAMERA"}
              size={76}
              backgroundColor="#1a1a1a"
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.serialText} numberOfLines={1}>
            {serialNumber}
          </Text>
        </View>

        <View style={styles.dividerLine} />

        {/* Right: Geo details */}
        <View style={styles.rightSection}>
          <Text style={styles.locationTitle} numberOfLines={1}>
            {locationName || "Unknown Location"}
          </Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </Text>
          <Text style={styles.plusCodeText} numberOfLines={1}>
            Plus Code : {plusCode}
          </Text>
          <Text style={styles.dateText} numberOfLines={1}>{dateStr}</Text>

          <View style={styles.bottomRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="weather-sunny" size={10} color="rgba(255,255,255,0.7)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="water-percent" size={10} color="rgba(255,255,255,0.7)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="image-filter-hdr" size={10} color="rgba(255,255,255,0.7)" />
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
    backgroundColor: "rgba(15, 15, 15, 0.90)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    gap: 8,
  },
  leftSection: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  qrWrapper: {
    padding: 4,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  dividerLine: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 1,
  },
  rightSection: {
    flex: 1,
    justifyContent: "center",
    gap: 1.5,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 13,
  },
  addressText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    lineHeight: 11,
  },
  plusCodeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 7.5,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  dateText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 7.5,
    fontFamily: "Inter_400Regular",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metaText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 7.5,
    fontFamily: "Inter_400Regular",
  },
  metaDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
});

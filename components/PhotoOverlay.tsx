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
  nearPlace?: string;
  note?: string;
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
  nearPlace,
  note,
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
      {note ? (
        <View style={styles.noteBar}>
          <Ionicons name="folder-open-outline" size={11} color="rgba(255,230,100,0.95)" />
          <Text style={styles.noteText} numberOfLines={1}>{note}</Text>
        </View>
      ) : null}
      <View style={styles.overlayBox}>

        {/* Left: QR + Serial */}
        <View style={styles.leftSection}>
          <View style={styles.qrWrapper}>
            <QRCodeView
              value={serialNumber || "GPS-CAMERA"}
              size={90}
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
          <Text style={styles.locationTitle} numberOfLines={2}>
            {locationName || "Unknown Location"}
          </Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
          </Text>
          <Text style={styles.plusCodeText} numberOfLines={1}>
            Plus Code : {plusCode}
          </Text>
          {nearPlace ? (
            <Text style={styles.nearText} numberOfLines={1}>
              Near : {nearPlace}
            </Text>
          ) : null}
          <Text style={styles.dateText} numberOfLines={1}>{dateStr}</Text>

          <View style={styles.bottomRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="weather-sunny" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="water-percent" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>—</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="image-filter-hdr" size={12} color="rgba(255,255,255,0.75)" />
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
  noteBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,230,100,0.3)",
  },
  noteText: {
    color: "rgba(255,230,100,0.95)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    letterSpacing: 0.2,
  },
  overlayBox: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 15, 15, 0.90)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
    gap: 10,
  },
  leftSection: {
    width: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  qrWrapper: {
    padding: 4,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  dividerLine: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 1,
  },
  rightSection: {
    flex: 1,
    justifyContent: "center",
    gap: 2.5,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    lineHeight: 17,
  },
  addressText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14.5,
  },
  plusCodeText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  nearText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
  },
  dateText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
});

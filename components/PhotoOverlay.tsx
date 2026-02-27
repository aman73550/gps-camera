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
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
    "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const dateStr = `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}  ${h}:${m}:${s}`;
  const altStr = altitude > 0 ? `${Math.round(altitude)} m` : "— m";

  return (
    <View style={styles.container}>
      {note ? (
        <View style={styles.noteBar}>
          <Ionicons name="folder-open-outline" size={13} color="rgba(255,230,100,0.95)" />
          <Text style={styles.noteText} numberOfLines={1}>{note}</Text>
        </View>
      ) : null}
      <View style={styles.overlayBox}>

        {/* Left: QR + Serial */}
        <View style={styles.leftSection}>
          <View style={styles.qrWrapper}>
            <QRCodeView
              value={serialNumber || "GPS-CAMERA"}
              size={96}
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
          {!!address && (
            <Text style={styles.addressText} numberOfLines={1}>
              {address}
            </Text>
          )}
          <Text style={styles.coordText} numberOfLines={1}>
            {`Lat: ${latitude.toFixed(6)}  Lon: ${longitude.toFixed(6)}`}
          </Text>
          {altitude > 0 && (
            <Text style={styles.coordText} numberOfLines={1}>
              {`Altitude: ${Math.round(altitude)} m`}
            </Text>
          )}
          <Text style={styles.plusCodeText} numberOfLines={1}>
            Plus Code : {plusCode}
          </Text>
          {nearPlace ? (
            <Text style={styles.nearText} numberOfLines={1}>
              Near : {nearPlace}
            </Text>
          ) : null}
          <Text style={styles.dateText} numberOfLines={1}>{dateStr}</Text>

          {/* Watermark row */}
          <View style={styles.bottomRow}>
            <View style={styles.watermarkTag}>
              <MaterialCommunityIcons name="shield-check" size={11} color="rgba(255,210,60,0.95)" />
              <Text style={styles.watermarkClickBy}>Click By </Text>
              <Text style={styles.watermarkAppName}>Verified GPS Camera</Text>
            </View>
            <View style={styles.metaSpacer} />
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="image-filter-hdr" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={styles.metaText}>{altStr}</Text>
            </View>
          </View>
          {/* Scan hint */}
          <Text style={styles.scanHintText}>Scan QR via app for verification</Text>
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
    backgroundColor: "rgba(15, 15, 15, 0.68)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,230,100,0.3)",
  },
  noteText: {
    color: "rgba(255,230,100,0.95)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    letterSpacing: 0.2,
  },
  overlayBox: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 15, 15, 0.68)",
    paddingHorizontal: 11,
    paddingVertical: 0,
    alignItems: "center",
    gap: 11,
  },
  leftSection: {
    width: 118,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  qrWrapper: {
    padding: 4,
    backgroundColor: "rgba(15, 15, 15, 0.75)",
    borderRadius: 5,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  dividerLine: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 2,
  },
  rightSection: {
    flex: 1,
    justifyContent: "center",
    gap: 2.5,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
  },
  addressText: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  coordText: {
    color: "rgba(160,220,255,0.95)",
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.2,
  },
  plusCodeText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  nearText: {
    color: "rgba(180,230,255,0.95)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  dateText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  watermarkTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  watermarkClickBy: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  watermarkAppName: {
    color: "rgba(255,210,60,0.95)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  metaSpacer: {
    flex: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scanHintText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QRCodeView } from "./QRCodeView";

function getVerifyUrl(serial: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/v/${serial}`;
  return serial;
}

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

  return (
    <View style={styles.container}>
      {note ? (
        <View style={styles.noteBar}>
          <Ionicons name="folder-open-outline" size={11} color="rgba(255,230,100,0.95)" />
          <Text style={styles.noteText} numberOfLines={1}>{note}</Text>
        </View>
      ) : null}
      <View style={styles.overlayBox}>

        <View style={styles.leftSection}>
          <View style={styles.qrWrapper}>
            <QRCodeView
              value={getVerifyUrl(serialNumber) || "GPS-CAMERA"}
              size={68}
              backgroundColor="#FFFFFF"
              color="#000000"
              correctionLevel="L"
            />
          </View>
          <Text style={styles.serialText} numberOfLines={1}>
            {serialNumber}
          </Text>
        </View>

        <View style={styles.dividerLine} />

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
          <Text style={styles.plusCodeText} numberOfLines={1}>
            Plus Code : {plusCode}
          </Text>
          <Text style={styles.dateText} numberOfLines={1}>{dateStr}</Text>

          <View style={styles.bottomRow}>
            <View style={styles.watermarkTag}>
              <MaterialCommunityIcons name="shield-check" size={10} color="rgba(255,210,60,0.95)" />
              <Text style={styles.watermarkClickBy}>Click By </Text>
              <Text style={styles.watermarkAppName}>Verified GPS Camera</Text>
            </View>
          </View>
          <Text style={styles.scanHintText}>Scan QR with any phone to verify</Text>
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
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
    backgroundColor: "rgba(15, 15, 15, 0.68)",
    paddingHorizontal: 9,
    paddingVertical: 0,
    alignItems: "center",
    gap: 9,
  },
  leftSection: {
    width: 85,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  qrWrapper: {
    padding: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  serialText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
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
    gap: 1.5,
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 15,
  },
  addressText: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  coordText: {
    color: "rgba(160,220,255,0.95)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.2,
  },
  plusCodeText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  dateText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
    gap: 5,
  },
  watermarkTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  watermarkClickBy: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  watermarkAppName: {
    color: "rgba(255,210,60,0.95)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  scanHintText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
});

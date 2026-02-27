import React from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

interface QRCodeViewProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
  correctionLevel?: "L" | "M" | "Q" | "H";
}

export function QRCodeView({
  value,
  size = 80,
  backgroundColor = "#FFFFFF",
  color = "#000000",
  correctionLevel = "L",
}: QRCodeViewProps) {
  return (
    <View
      style={{
        padding: 4,
        backgroundColor,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <QRCode
        value={value}
        size={size}
        backgroundColor={backgroundColor}
        color={color}
        ecl={correctionLevel}
      />
    </View>
  );
}

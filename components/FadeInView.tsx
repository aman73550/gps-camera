import React, { useCallback } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";

const M3_EASING = Easing.bezier(0.4, 0, 0.2, 1);

interface FadeInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export function FadeInView({ children, style, duration = 280 }: FadeInViewProps) {
  const opacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration, easing: M3_EASING });
    }, [duration, opacity]),
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, style, animStyle]}>
      {children}
    </Animated.View>
  );
}

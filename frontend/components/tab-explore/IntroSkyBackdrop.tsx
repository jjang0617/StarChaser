import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** 탭 인트로용 — 실제 천구와 비슷한 흐릿한 밤하늘 분위기 */
const STAR_SEED = [
  [12, 18, 0.9], [28, 42, 0.55], [44, 12, 0.75], [58, 28, 0.5], [72, 8, 0.85],
  [18, 62, 0.45], [35, 78, 0.7], [52, 55, 0.4], [66, 72, 0.6], [82, 38, 0.8],
  [8, 34, 0.35], [22, 88, 0.5], [48, 22, 0.65], [76, 58, 0.55], [90, 14, 0.7],
  [15, 48, 0.4], [38, 32, 0.6], [61, 48, 0.45], [84, 82, 0.35], [6, 76, 0.5],
  [55, 8, 0.55], [70, 44, 0.65], [32, 68, 0.4], [88, 52, 0.5], [42, 92, 0.38],
];

export function IntroSkyBackdrop() {
  const twinkle = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0.55,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  const stars = useMemo(() => STAR_SEED, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="skyBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0a1628" />
            <Stop offset="55%" stopColor="#050d18" />
            <Stop offset="100%" stopColor="#02060e" />
          </LinearGradient>
          <LinearGradient id="milky" x1="5" y1="95" x2="95" y2="5">
            <Stop offset="0%" stopColor="#5860a0" stopOpacity="0" />
            <Stop offset="45%" stopColor="#8890c8" stopOpacity="0.12" />
            <Stop offset="55%" stopColor="#9098d0" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#5860a0" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id="horizon" cx="50%" cy="100%" rx="80%" ry="40%">
            <Stop offset="0%" stopColor="#1a2848" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#1a2848" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#skyBase)" />
        <Rect width="100%" height="100%" fill="url(#horizon)" />
        <Rect width="100%" height="100%" fill="url(#milky)" opacity={0.85} />
        {stars.map(([x, y, o], i) => (
          <Circle
            key={i}
            cx={`${x}%`}
            cy={`${y}%`}
            r={o > 0.7 ? 1.1 : 0.75}
            fill="#f8fafc"
            opacity={o}
          />
        ))}
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(141, 220, 255, 0.04)', opacity: twinkle },
        ]}
      />
    </View>
  );
}

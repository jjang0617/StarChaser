import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

const STAR_SEED = [
  [14, 22, 0.5], [72, 18, 0.35], [48, 38, 0.4], [88, 42, 0.3], [26, 58, 0.45],
  [62, 72, 0.35], [8, 78, 0.4], [42, 12, 0.55], [78, 68, 0.28],
];

/** DIARY 탭 — 은은한 밤하늘·일기 분위기 */
export function IntroDiaryBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="diaryBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0c1424" />
            <Stop offset="50%" stopColor="#060c16" />
            <Stop offset="100%" stopColor="#030712" />
          </LinearGradient>
          <RadialGradient id="diaryGlow" cx="50%" cy="28%" rx="70%" ry="45%">
            <Stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#1e3a5f" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#diaryBase)" />
        <Rect width="100%" height="55%" fill="url(#diaryGlow)" />
        {STAR_SEED.map(([x, y, o], i) => (
          <Circle
            key={i}
            cx={`${x}%`}
            cy={`${y}%`}
            r={0.8}
            fill="#e2e8f0"
            opacity={o}
          />
        ))}
      </Svg>
    </View>
  );
}

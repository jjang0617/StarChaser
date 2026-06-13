import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

/** 지도 로딩 전 폴백 — 격자·마커 느낌의 어두운 지도 */
const MARKERS: [number, number][] = [
  [28, 38], [42, 52], [55, 35], [68, 48], [38, 62], [72, 58], [48, 28], [62, 72],
];

export function IntroMapBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#0c1828" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#061018" stopOpacity="0.45" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#mapBg)" />
        {Array.from({ length: 9 }, (_, i) => (
          <Line
            key={`h-${i}`}
            x1="0"
            y1={`${10 + i * 10}%`}
            x2="100%"
            y2={`${10 + i * 10}%`}
            stroke="rgba(141, 220, 255, 0.06)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <Line
            key={`v-${i}`}
            x1={`${12 + i * 12}%`}
            y1="0"
            x2={`${12 + i * 12}%`}
            y2="100%"
            stroke="rgba(141, 220, 255, 0.05)"
            strokeWidth={1}
          />
        ))}
        {MARKERS.map(([x, y], i) => (
          <Circle
            key={i}
            cx={`${x}%`}
            cy={`${y}%`}
            r={i % 3 === 0 ? 4 : 3}
            fill={i % 3 === 0 ? 'rgba(141, 220, 255, 0.35)' : 'rgba(141, 220, 255, 0.2)'}
          />
        ))}
      </Svg>
    </View>
  );
}

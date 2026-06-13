/**
 * 로그인·회원가입 — 별·유성 배경 (SKY 인트로 + 유성 애니메이션)
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { IntroSkyBackdrop } from '../tab-explore/IntroSkyBackdrop';

type MeteorSpec = {
  delay: number;
  pause: number;
  left: number;
  top: number;
  length: number;
  duration: number;
};

const METEORS: MeteorSpec[] = [
  { delay: 400, pause: 4200, left: 8, top: 6, length: 52, duration: 720 },
  { delay: 1800, pause: 5600, left: 62, top: 4, length: 44, duration: 640 },
  { delay: 3200, pause: 4800, left: 38, top: 14, length: 48, duration: 680 },
  { delay: 5200, pause: 6200, left: 78, top: 18, length: 40, duration: 600 },
  { delay: 7000, pause: 5400, left: 22, top: 22, length: 46, duration: 660 },
];

function ShootingStar({ spec }: { spec: MeteorSpec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(spec.pause),
      ]),
    );
    run.start();
    return () => run.stop();
  }, [progress, spec.delay, spec.duration, spec.pause]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.length * 1.6],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.length],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.75, 1],
    outputRange: [0, 1, 0.85, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.meteor,
        {
          left: `${spec.left}%`,
          top: `${spec.top}%`,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate: '38deg' }],
        },
      ]}
    >
      <View style={[styles.meteorHead, { width: spec.length }]} />
      <View style={styles.meteorTail} />
    </Animated.View>
  );
}

export function AuthStarryBackdrop() {
  const meteors = useMemo(() => METEORS, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <IntroSkyBackdrop />
      <View style={StyleSheet.absoluteFill}>
        {meteors.map((spec, i) => (
          <ShootingStar key={i} spec={spec} />
        ))}
      </View>
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  meteor: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  meteorHead: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    shadowColor: '#8DDCFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  meteorTail: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -2,
    backgroundColor: 'rgba(141, 220, 255, 0.55)',
  },
  vignetteTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 7, 18, 0.18)',
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: 'rgba(2, 6, 14, 0.55)',
  },
});

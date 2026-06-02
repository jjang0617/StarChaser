import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../themes/ThemeContext';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GAUGE_SIZE = 232;
const STROKE = 11;
const R = (GAUGE_SIZE - STROKE) / 2 - 4;
const C = 2 * Math.PI * R;

const STAR_DOTS = [
  { x: 0.22, y: 0.18, o: 0.35 },
  { x: 0.72, y: 0.24, o: 0.5 },
  { x: 0.38, y: 0.78, o: 0.28 },
  { x: 0.82, y: 0.62, o: 0.4 },
  { x: 0.14, y: 0.55, o: 0.32 },
  { x: 0.55, y: 0.42, o: 0.22 },
];

/** 점마다 다른 속도·딜레이로 어긋나게 튀어 오르는 측정 중 … */
const MEASURING_DOT_LOOPS = [
  { delay: 0, rise: 260, fall: 380, hold: 90, peak: -7 },
  { delay: 140, rise: 340, fall: 290, hold: 160, peak: -5 },
  { delay: 280, rise: 310, fall: 420, hold: 50, peak: -8 },
] as const;

function startMeasuringDotLoop(anim: Animated.Value, cfg: (typeof MEASURING_DOT_LOOPS)[number]) {
  anim.setValue(0);
  const bounce = Animated.loop(
    Animated.sequence([
      Animated.timing(anim, {
        toValue: cfg.peak,
        duration: cfg.rise,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: cfg.fall,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(cfg.hold),
    ]),
  );
  if (cfg.delay <= 0) return bounce;
  return Animated.sequence([Animated.delay(cfg.delay), bounce]);
}

export function MeasuringDots({ color }: { color: string }) {
  const y0 = useRef(new Animated.Value(0)).current;
  const y1 = useRef(new Animated.Value(0)).current;
  const y2 = useRef(new Animated.Value(0)).current;
  const anims = useMemo(() => [y0, y1, y2], [y0, y1, y2]);

  useEffect(() => {
    const loops = MEASURING_DOT_LOOPS.map((cfg, i) => startMeasuringDotLoop(anims[i], cfg));
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.measuringDotsRow}>
      {anims.map((translateY, i) => (
        <Animated.Text
          key={i}
          style={[styles.measuringDot, { color, transform: [{ translateY }] }]}
        >
          ·
        </Animated.Text>
      ))}
    </View>
  );
}

interface AnimatedStarIndexGaugeProps {
  score?: number;
  /** 데이터가 새로 로드되면 애니메이션을 다시 재생 */
  animateKey?: string;
  /** 측정 중 — 링 펄스 + 중앙 플레이스홀더 */
  loading?: boolean;
}

export function AnimatedStarIndexGauge({
  score = 0,
  animateKey,
  loading = false,
}: AnimatedStarIndexGaugeProps) {
  const { theme } = useTheme();
  const display = getStarIndexScoreDisplay(score);
  const target = display.measurable ? display.gaugePercent : 0;

  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;
  const [shownScore, setShownScore] = useState(0);

  const scoreColor = !display.measurable
    ? theme.destructive
    : score >= 75
      ? theme.primaryGlow
      : theme.moonlight;

  const cx = GAUGE_SIZE / 2;
  const cy = GAUGE_SIZE / 2;

  useEffect(() => {
    if (loading) return;
    progress.setValue(0);
    setShownScore(0);

    const id = progress.addListener(({ value }) => {
      setShownScore(Math.round((value / 100) * target));
    });

    const anim = Animated.timing(progress, {
      toValue: 100,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();

    return () => {
      progress.removeListener(id);
      anim.stop();
    };
  }, [target, animateKey, progress, loading]);

  useEffect(() => {
    if (!loading) return;
    pulse.setValue(0.35);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loading, pulse]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [C, C * (1 - target / 100)],
  });

  const loadingDashoffset = C * 0.62;
  const ringOpacity = loading ? pulse : 1;

  const scoreText = useMemo(() => {
    if (loading) return null;
    if (!display.measurable) {
      const n = Math.round(score);
      return Number.isFinite(n) ? String(n) : '—';
    }
    return String(shownScore);
  }, [display.measurable, shownScore, loading, score]);

  return (
    <View style={styles.wrap}>
      <View style={styles.dotsLayer} pointerEvents="none">
        {STAR_DOTS.map((d, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: d.x * GAUGE_SIZE,
                top: d.y * GAUGE_SIZE,
                opacity: loading ? d.o * 0.45 : d.o,
                backgroundColor: theme.foreground,
              },
            ]}
          />
        ))}
      </View>

      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        <Circle
          cx={cx}
          cy={cy}
          r={R}
          stroke={theme.borderSubtle}
          strokeWidth={STROKE}
          fill="rgba(0,0,0,0.25)"
        />
        {loading ? (
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={R}
            stroke={theme.primaryGlow}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C * 0.38} ${C}`}
            strokeDashoffset={loadingDashoffset}
            strokeLinecap="round"
            opacity={ringOpacity}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : (
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={R}
            stroke={scoreColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {loading ? (
          <MeasuringDots color={theme.mutedForeground} />
        ) : (
          <Text
            style={[
              styles.score,
              {
                color: theme.foreground,
                fontFamily: 'SpaceMono-Regular',
              },
            ]}
          >
            {scoreText}
          </Text>
        )}
        <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
        <Text style={[styles.rateLabel, { color: theme.mutedForeground }]}>
          {loading ? 'MEASURING' : 'SUCCESS RATE'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  score: {
    fontSize: 52,
    fontWeight: '300',
    letterSpacing: -1,
  },
  measuringDotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    paddingBottom: 4,
  },
  measuringDot: {
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 44,
    fontFamily: 'SpaceMono-Regular',
  },
  divider: {
    width: 48,
    height: 1,
  },
  rateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
});

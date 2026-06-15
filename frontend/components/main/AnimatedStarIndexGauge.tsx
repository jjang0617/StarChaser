import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../themes/ThemeContext';
import { spacing } from '../../themes/design-tokens';
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
  /** 위치 권한 등으로 측정 불가 — 중앙 ? */
  unknown?: boolean;
  // New props for refresh
  onPressRefresh?: () => void;
  refreshing?: boolean;
  refreshFeedback?: { tone: 'success' | 'error'; message: string } | null;
  lastRefreshLabel?: string | null;
}

export function AnimatedStarIndexGauge({
  score = 0,
  animateKey,
  loading = false,
  unknown = false,
  onPressRefresh,
  refreshing = false,
  refreshFeedback = null,
  lastRefreshLabel = null,
}: AnimatedStarIndexGaugeProps) {
  const { theme } = useTheme();
  const display = getStarIndexScoreDisplay(score);
  const target = display.gaugePercent;

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
    if (loading || unknown) return;
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
  }, [target, animateKey, progress, loading, unknown]);

  useEffect(() => {
    if (!loading || unknown) return;
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
  const unknownDashoffset = C * 0.72;
  const ringOpacity = loading ? pulse : 1;

  const scoreText = useMemo(() => {
    if (loading || unknown) return null;
    if (!display.measurable) {
      const n = Math.round(score);
      return Number.isFinite(n) ? String(n) : '—';
    }
    return String(shownScore);
  }, [display.measurable, shownScore, loading, unknown, score]);

  const ringColor = unknown ? theme.mutedForeground : scoreColor;

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
                opacity: loading ? d.o * 0.45 : unknown ? d.o * 0.3 : d.o,
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
        ) : unknown ? (
          <Circle
            cx={cx}
            cy={cy}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C * 0.28} ${C}`}
            strokeDashoffset={unknownDashoffset}
            strokeLinecap="round"
            opacity={0.55}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : (
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </Svg>

      <View style={styles.center} pointerEvents="box-none">
        {loading ? (
          <MeasuringDots color={theme.mutedForeground} />
        ) : unknown ? (
          <Text
            style={[
              styles.score,
              styles.unknownScore,
              { color: theme.mutedForeground },
            ]}
          >
            ?
          </Text>
        ) : (
          <Text
            style={[
              styles.score,
              {
                // 50점 미만(관측 어려움)은 숫자도 빨간색으로 — 그 외 구간은 흰색 유지
                color: display.measurable ? theme.foreground : theme.destructive,
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

        {!loading && !unknown && onPressRefresh ? (
          <Pressable
            onPress={onPressRefresh}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.refreshTap,
              refreshing && styles.refreshTapBusy,
              pressed && !refreshing && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              refreshing ? 'Star-Index 갱신 중' : 'Star-Index 새로고침'
            }
            accessibilityState={{ busy: refreshing }}
          >
            {refreshing ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="small" color={theme.primaryGlow} />
                <Text style={[styles.refreshText, { color: theme.primaryGlow }]}>
                  갱신 중…
                </Text>
              </View>
            ) : refreshFeedback?.tone === 'error' ? (
              <Text style={[styles.refreshText, { color: theme.destructive }]}>
                {refreshFeedback.message}
              </Text>
            ) : refreshFeedback?.tone === 'success' ? (
              <View style={styles.refreshCol}>
                <Text style={[styles.refreshText, { color: theme.primaryGlow }]}>
                  탭하여 갱신
                </Text>
                <Text style={[styles.refreshSubText, { color: theme.primaryGlow }]}>
                  {refreshFeedback.message}
                </Text>
              </View>
            ) : (
              <View style={styles.refreshCol}>
                <Text style={[styles.refreshText, { color: theme.mutedForeground }]}>
                  탭하여 갱신
                </Text>
                {lastRefreshLabel ? (
                  <Text style={[styles.refreshSubText, { color: theme.mutedForeground }]}>
                    {lastRefreshLabel}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        ) : null}
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
    gap: 2,
  },
  score: {
    fontSize: 52,
    fontWeight: '300',
    letterSpacing: -1,
    fontFamily: 'SpaceMono-Regular',
  },
  unknownScore: {
    opacity: 0.72,
    letterSpacing: 0,
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
  refreshTap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 28,
    justifyContent: 'center',
    marginTop: 4,
  },
  refreshTapBusy: {
    opacity: 0.92,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshCol: {
    alignItems: 'center',
    gap: 1,
  },
  refreshText: {
    fontSize: 11,
  },
  refreshSubText: {
    fontSize: 10,
    opacity: 0.85,
  },
});

/**
 * StarChaser — Card
 * Figma: 반투명 글래스 · card-border · rounded-xl
 */

import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { glassCardStyle, typography } from '../../themes/design-tokens';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { useTheme } from '../../themes/ThemeContext';
import { Badge } from './Badge';
import { Button } from './Button';

interface CardProps {
  children:  ReactNode;
  onPress?:  () => void;
  style?:    ViewStyle;
  title?:    string;
  description?: string;
}

export function Card({ children, onPress, style, title, description }: CardProps) {
  const { theme } = useTheme();

  const inner = (
    <View style={[styles.card, glassCardStyle(theme), style]}>
      {title && (
        <Text style={[styles.title, typography.h3, { color: theme.foreground }]}>
          {title}
        </Text>
      )}
      {description && (
        <Text style={[styles.desc, typography.caption, { color: theme.mutedForeground }]}>
          {description}
        </Text>
      )}
      {(title || description) && children ? (
        <View style={styles.childrenWrap}>{children}</View>
      ) : (
        children
      )}
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {inner}
    </Pressable>
  );
}

export type StatefulCardError = {
  cardDescription: string;
  lines: string[];
  isTransient?: boolean;
};

interface StatefulCardProps {
  title: string;
  description?: string;
  loading: boolean;
  error?: StatefulCardError | null;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
}

export function StatefulCard({
  title,
  description,
  loading,
  error,
  onRetry,
  retryLabel = '다시 시도',
  children,
  footer,
  style,
}: StatefulCardProps) {
  const { theme } = useTheme();

  const desc =
    description ??
    (loading ? '불러오는 중…' : error ? error.cardDescription : undefined);

  return (
    <View style={[styles.card, glassCardStyle(theme), style]}>
      {title ? (
        <Text style={[styles.title, typography.h3, { color: theme.foreground }]}>
          {title}
        </Text>
      ) : null}
      {desc ? (
        <Text style={[styles.desc, typography.caption, { color: theme.mutedForeground }]}>
          {desc}
        </Text>
      ) : null}

      <View style={[styles.stateBody, (title || desc) && styles.stateBodyAfterHeader]}>
        {loading ? (
          <ActivityIndicator color={theme.primaryGlow} />
        ) : error ? (
          <>
            {error.lines.map((line, i) => (
              <Text
                key={i}
                style={{
                  color: error.isTransient ? theme.mutedForeground : theme.destructive,
                  fontSize: 12,
                  lineHeight: 16,
                  marginBottom: i < error.lines.length - 1 ? 8 : 0,
                }}
              >
                {line}
              </Text>
            ))}
            {onRetry ? (
              <Button
                label={retryLabel}
                variant="outline"
                size="sm"
                style={{ marginTop: 6, alignSelf: 'flex-start' }}
                onPress={onRetry}
              />
            ) : null}
          </>
        ) : (
          children
        )}
        {footer ? <View style={styles.stateFooter}>{footer}</View> : null}
      </View>
    </View>
  );
}

interface StarIndexCardProps {
  score:        number;
  cloudLabel:   string;
  pm25Level:    string;
  moonAltitude: number;
  moonAltitudeKnown?: boolean;
  onPress?:     () => void;
  bare?: boolean;
  showCircularGauge?: boolean;
}

export function StarIndexCard({
  score,
  cloudLabel,
  pm25Level,
  moonAltitude,
  moonAltitudeKnown = true,
  onPress,
  bare = false,
  showCircularGauge = true,
}: StarIndexCardProps) {
  const { theme } = useTheme();
  const scoreDisplay = getStarIndexScoreDisplay(score);

  const status = !scoreDisplay.measurable
    ? scoreDisplay.label
    : score >= 75
      ? '관측 적합'
      : '부분 관측';

  const scoreColor = !scoreDisplay.measurable
    ? theme.destructive
    : score >= 75
      ? theme.primaryGlow
      : theme.moonlight;

  const moonLabel =
    moonAltitudeKnown ? `${moonAltitude}°` : '미상';

  const dataItems = [
    { key: 'CLOUD', value: cloudLabel },
    { key: 'PM2.5', value: pm25Level },
    { key: 'MOON',  value: moonLabel },
  ];

  const gaugeR = 36;
  const gaugeC = 2 * Math.PI * gaugeR;
  const gaugeDash = (scoreDisplay.gaugePercent / 100) * gaugeC;

  const inner = (
    <>
      <View style={styles.siTop}>
        <View style={styles.siLeftRow}>
          {showCircularGauge ? (
            <Svg width={88} height={88} viewBox="0 0 88 88">
              <Circle
                cx="44"
                cy="44"
                r={gaugeR}
                stroke={theme.borderSubtle}
                strokeWidth={7}
                fill="none"
              />
              <Circle
                cx="44"
                cy="44"
                r={gaugeR}
                stroke={scoreColor}
                strokeWidth={7}
                fill="none"
                strokeDasharray={`${gaugeDash} ${gaugeC}`}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
              />
            </Svg>
          ) : null}
          <View>
            <Text style={[styles.siLabel, { color: theme.mutedForeground }]}>
              STAR · INDEX
            </Text>
            <Text
              style={[
                styles.siScore,
                {
                  color: scoreColor,
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: scoreDisplay.measurable ? 40 : 22,
                  lineHeight: scoreDisplay.measurable ? 44 : 28,
                },
              ]}
            >
              {scoreDisplay.label}
            </Text>
          </View>
        </View>
        <View style={styles.siRight}>
          <Badge
            label={status}
            variant={
              !scoreDisplay.measurable
                ? 'red'
                : score >= 75
                  ? 'glow'
                  : 'steel'
            }
          />
          <Text style={[styles.siRefresh, { color: theme.mutedForeground }]}>
            1H REFRESH
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

      <View style={styles.dataGrid}>
        {dataItems.map((item, i) => (
          <View
            key={item.key}
            style={[
              styles.dataCell,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.borderSubtle },
            ]}
          >
            <Text style={[styles.dataKey, { color: theme.mutedForeground }]}>
              {item.key}
            </Text>
            <Text style={[styles.dataVal, { color: theme.foreground, fontFamily: 'SpaceMono-Regular' }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  if (bare) {
    if (!onPress) return inner;
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {inner}
      </Pressable>
    );
  }

  return <Card onPress={onPress}>{inner}</Card>;
}

interface SpotCardProps {
  name:        string;
  region:      string;
  elevation:   number;
  bortleClass: number;
  starIndex:   number;
  hasParking:  boolean;
  hasToilet:   boolean;
  distanceKm?: number;
  onPress?:    () => void;
  bare?: boolean;
}

export function SpotCard({
  name, region, elevation, bortleClass,
  starIndex, hasParking, hasToilet, distanceKm, onPress,
  bare = false,
}: SpotCardProps) {
  const { theme } = useTheme();
  const scoreDisplay = getStarIndexScoreDisplay(starIndex);

  const bortleVariant =
    bortleClass <= 3 ? 'glow' :
    bortleClass <= 5 ? 'steel' : 'muted';

  const inner = (
    <>
      <View style={styles.spotTop}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.spotName, { color: theme.foreground }]}>{name}</Text>
          <Text style={[styles.spotRegion, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
            {region}{distanceKm != null ? `  ·  ${distanceKm.toFixed(0)}km` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[
              styles.spotScore,
              {
                color: scoreDisplay.measurable ? theme.primaryGlow : theme.destructive,
                fontFamily: 'SpaceMono-Regular',
                fontSize: scoreDisplay.measurable ? 22 : 13,
                lineHeight: scoreDisplay.measurable ? 24 : 18,
              },
            ]}
          >
            {scoreDisplay.label}
          </Text>
          <Text style={[styles.spotScoreLabel, { color: theme.mutedForeground }]}>
            INDEX
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

      <View style={styles.badgeRow}>
        <Badge label={`Bortle ${bortleClass}`} variant={bortleVariant} mono />
        <Badge label={`▲ ${elevation}m`} variant="steel" mono />
        {hasParking && <Badge label="주차" variant="muted" />}
        {hasToilet  && <Badge label="화장실" variant="muted" />}
      </View>
    </>
  );

  if (bare) {
    if (!onPress) return inner;
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {inner}
      </Pressable>
    );
  }

  return <Card onPress={onPress}>{inner}</Card>;
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  title: {
    marginBottom: 2,
  },
  desc: {
    marginBottom: 4,
  },
  childrenWrap: {
    marginTop: 10,
  },

  stateBody: {
    gap: 10,
  },
  stateBodyAfterHeader: {
    marginTop: 10,
  },
  stateFooter: {
    marginTop: 4,
  },

  siTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   10,
  },
  siLeftRow: {
    flexDirection: 'row',
    alignItems:     'center',
    gap:            10,
    flexShrink:     1,
  },
  siLabel: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       9,
    letterSpacing:  2,
    textTransform: 'uppercase',
    marginBottom:   2,
  },
  siScore: {
    fontSize:   40,
    fontWeight: '700',
    lineHeight: 44,
  },
  siRight: {
    alignItems: 'flex-end',
    gap:         4,
    paddingTop:  2,
  },
  siRefresh: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       8,
    letterSpacing:  0.5,
    marginTop:      4,
  },

  divider: {
    height:        1,
    marginBottom: 10,
  },

  dataGrid: {
    flexDirection: 'row',
  },
  dataCell: {
    flex:          1,
    alignItems:    'center',
    paddingVertical: 5,
  },
  dataKey: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       8,
    letterSpacing:  1.5,
    textTransform: 'uppercase',
    marginBottom:   3,
  },
  dataVal: {
    fontSize:   14,
    fontWeight: '700',
  },

  spotTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:    6,
  },
  spotName: {
    fontSize:   15,
    fontWeight: '600',
    marginBottom: 2,
  },
  spotRegion: {
    fontSize:      11,
    letterSpacing: 0.3,
  },
  spotScore: {
    fontSize:   22,
    fontWeight: '700',
    lineHeight: 24,
  },
  spotScoreLabel: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       7,
    letterSpacing:  1,
    marginTop:      1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            6,
  },
});

/**
 * StarChaser — Card
 * Anti-AI: Shadow 완전 없음 · Border 중심 · padding 12px 고밀도
 * StarIndexCard / SpotCard 전용 variant 포함
 */

import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { Badge } from './Badge';

// ── 기본 Card 래퍼 ──
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor:     theme.border,
          borderRadius:    theme.radius,
          // ⚠️ elevation/shadow 없음 — Anti-AI
        },
        style,
      ]}
    >
      {title && (
        <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
      )}
      {description && (
        <Text style={[styles.desc, { color: theme.mutedForeground }]}>{description}</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {inner}
    </Pressable>
  );
}

// ── Star-Index 숫자 카드 ──
interface StarIndexCardProps {
  score:        number;
  cloudCover:   number;   // % 운량
  pm25Level:    string;   // '좋음' | '보통' | '나쁨'
  moonAltitude: number;   // 달 고도 (도)
  onPress?:     () => void;
}

export function StarIndexCard({
  score,
  cloudCover,
  pm25Level,
  moonAltitude,
  onPress,
}: StarIndexCardProps) {
  const { theme } = useTheme();

  const status =
    score >= 75 ? '관측 적합' :
    score >= 50 ? '부분 관측' : '관측 불가';

  const scoreColor =
    score >= 75 ? theme.starGold :
    score >= 50 ? theme.moonlight : theme.mutedForeground;

  const dataItems = [
    { key: 'CLOUD', value: `${cloudCover}%` },
    { key: 'PM2.5', value: pm25Level },
    { key: 'MOON',  value: `${moonAltitude}°` },
  ];

  return (
    <Card onPress={onPress}>
      {/* 헤더 행 */}
      <View style={styles.siTop}>
        <View>
          <Text style={[styles.siLabel, { color: theme.mutedForeground }]}>
            STAR · INDEX
          </Text>
          <Text style={[styles.siScore, { color: scoreColor, fontFamily: 'SpaceMono-Regular' }]}>
            {score}
          </Text>
        </View>
        <View style={styles.siRight}>
          <Badge
            label={status}
            variant={score >= 75 ? 'gold' : score >= 50 ? 'steel' : 'muted'}
          />
          <Text style={[styles.siRefresh, { color: theme.mutedForeground }]}>
            1H REFRESH
          </Text>
        </View>
      </View>

      {/* 구분선 — borderSubtle */}
      <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

      {/* 데이터 그리드 */}
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
    </Card>
  );
}

// ── 명소 카드 ──
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
}

export function SpotCard({
  name, region, elevation, bortleClass,
  starIndex, hasParking, hasToilet, distanceKm, onPress,
}: SpotCardProps) {
  const { theme } = useTheme();

  const bortleVariant =
    bortleClass <= 3 ? 'gold' :
    bortleClass <= 5 ? 'steel' : 'muted';

  return (
    <Card onPress={onPress}>
      <View style={styles.spotTop}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.spotName, { color: theme.foreground }]}>{name}</Text>
          <Text style={[styles.spotRegion, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
            {region}{distanceKm != null ? `  ·  ${distanceKm.toFixed(0)}km` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.spotScore, { color: theme.starGold, fontFamily: 'SpaceMono-Regular' }]}>
            {starIndex}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding:     12,   // 고밀도 — 큰 padding 금지
  },
  title: {
    fontSize:   15,
    fontWeight: '600',
    marginBottom: 2,
  },
  desc: {
    fontSize:   13,
    lineHeight: 18,
    marginBottom: 4,
  },
  childrenWrap: {
    marginTop: 10,
  },

  // Star-Index Card
  siTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   10,
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

  // 구분선
  divider: {
    height:        1,
    marginBottom: 10,
  },

  // 데이터 그리드
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

  // Spot Card
  spotTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:    6,
  },
  spotName: {
    fontSize:   14,
    fontWeight: '600',
    marginBottom: 2,
  },
  spotRegion: {
    fontSize:      9,
    letterSpacing: 0.5,
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
    gap:            4,
  },
});

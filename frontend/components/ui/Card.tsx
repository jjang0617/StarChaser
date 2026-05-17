/**
 * StarChaser — Card
 * Anti-AI: Shadow 완전 없음 · Border 중심 · padding 12px 고밀도
 * StarIndexCard / SpotCard 전용 variant 포함
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
import { useTheme } from '../../themes/ThemeContext';
import { Badge } from './Badge';
import { Button } from './Button';

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

/** 로딩/에러/정상 UI를 Card 안에서 일관되게 보여줄 때 사용 */
export type StatefulCardError = {
  cardDescription: string;
  lines: string[];
  /** true면 안내 톤(빨간 에러색 대신 muted) */
  isTransient?: boolean;
};

interface StatefulCardProps {
  title: string;
  /** 로딩/에러 시 카드 상단 설명(선택). 없으면 기본 문구 사용 */
  description?: string;
  loading: boolean;
  error?: StatefulCardError | null;
  onRetry?: () => void;
  retryLabel?: string;
  /** 성공 상태 본문 */
  children?: ReactNode;
  /** 성공/에러 하단 액션(닫기 등) */
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderRadius: theme.radius,
        },
        style,
      ]}
    >
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {desc ? <Text style={[styles.desc, { color: theme.mutedForeground }]}>{desc}</Text> : null}

      <View style={[styles.stateBody, (title || desc) && styles.stateBodyAfterHeader]}>
        {loading ? (
          <ActivityIndicator color={theme.starGold} />
        ) : error ? (
          <>
            {error.lines.map((line, i) => (
              <Text
                key={i}
                style={{
                  color: error.isTransient ? theme.mutedForeground : theme.dimRedFg,
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

// ── Star-Index 숫자 카드 ──
interface StarIndexCardProps {
  score:        number;
  cloudLabel:   string;   // 맑음·구름조금·구름많음·흐림
  pm25Level:    string;   // 예: 12㎍/㎥·칠곡군
  moonAltitude: number;   // 달 고도 (도) — unknown이면 표시만 생략
  /** false면 KASI 고도 미수신 등 — MOON 칸에 미상 */
  moonAltitudeKnown?: boolean;
  onPress?:     () => void;
  /** true면 바깥 Card 래퍼 없이 내용만 렌더(StatefulCard 등 중첩 방지) */
  bare?: boolean;
  /** 원형 게이지(Phase 1 홈 Star-Index) */
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

  const status =
    score >= 75 ? '관측 적합' :
    score >= 50 ? '부분 관측' : '관측 불가';

  const scoreColor =
    score >= 75 ? theme.starGold :
    score >= 50 ? theme.moonlight : theme.mutedForeground;

  const moonLabel =
    moonAltitudeKnown ? `${moonAltitude}°` : '미상';

  const dataItems = [
    { key: 'CLOUD', value: cloudLabel },
    { key: 'PM2.5', value: pm25Level },
    { key: 'MOON',  value: moonLabel },
  ];

  const gaugeR = 36;
  const gaugeC = 2 * Math.PI * gaugeR;
  const gaugeDash = (score / 100) * gaugeC;

  const inner = (
    <>
      {/* 헤더 행 — 원형 게이지 + 점수(기획서 홈 게이지 MVP) */}
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
              style={[styles.siScore, { color: scoreColor, fontFamily: 'SpaceMono-Regular' }]}
            >
              {score}
            </Text>
          </View>
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
    </>
  );

  if (bare) {
    if (!onPress) return inner;
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        {inner}
      </Pressable>
    );
  }

  return <Card onPress={onPress}>{inner}</Card>;
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
  /** true면 바깥 Card 래퍼 없이 내용만 렌더(StatefulCard 등 중첩 방지) */
  bare?: boolean;
}

export function SpotCard({
  name, region, elevation, bortleClass,
  starIndex, hasParking, hasToilet, distanceKm, onPress,
  bare = false,
}: SpotCardProps) {
  const { theme } = useTheme();

  const bortleVariant =
    bortleClass <= 3 ? 'gold' :
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
    </>
  );

  if (bare) {
    if (!onPress) return inner;
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        {inner}
      </Pressable>
    );
  }

  return <Card onPress={onPress}>{inner}</Card>;
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

  stateBody: {
    gap: 10,
  },
  stateBodyAfterHeader: {
    marginTop: 10,
  },
  stateFooter: {
    marginTop: 4,
  },

  // Star-Index Card
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

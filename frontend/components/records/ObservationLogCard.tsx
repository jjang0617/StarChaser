/**
 * Figma LOG — 관측 기록 카드
 */

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ObservationRowDto } from '../../lib/api-client';
import { formatCloudForCard, getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { GlassCard } from '../ui/GlassCard';

const RESULT_META: Record<
  ObservationRowDto['result'],
  { label: string; icon: React.ComponentProps<typeof Feather>['name'] }
> = {
  success: { label: '성공', icon: 'check-circle' },
  partial: { label: '부분 성공', icon: 'info' },
  fail: { label: '실패', icon: 'x-circle' },
};

function formatObservationDateKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}.${m}.${day}`;
}

function formatObservationTimeKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatStarIndexValue(val: number): string {
  const d = getStarIndexScoreDisplay(val);
  if (!d.measurable) return d.label;
  const n = Math.round(val);
  return String(n);
}

export interface ObservationLogCardProps {
  title: string;
  regionSubtitle?: string;
  row: ObservationRowDto;
  /** 사진 API 연동 전까지 0 — UI 슬롯만 유지 */
  photoCount?: number;
}

function ResultBadge({ result }: { result: ObservationRowDto['result'] }) {
  const { theme } = useTheme();
  const meta = RESULT_META[result];

  const borderColor =
    result === 'success'
      ? theme.primaryGlowBorder
      : result === 'partial'
        ? 'rgba(93, 173, 235, 0.45)'
        : 'rgba(239, 68, 68, 0.45)';

  const textColor =
    result === 'success'
      ? theme.primaryGlow
      : result === 'partial'
        ? theme.secondary
        : theme.destructive;

  return (
    <View style={[styles.badge, { borderColor, backgroundColor: theme.primaryGlowMuted }]}>
      <Feather name={meta.icon} size={12} color={textColor} />
      <Text style={[styles.badgeText, { color: textColor }]}>{meta.label}</Text>
    </View>
  );
}

function MetricCell({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  valueColor: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.metricCell}>
      <View style={styles.metricLabelRow}>
        <Feather name={icon} size={12} color={theme.mutedForeground} />
        <Text style={[styles.metricLabel, { color: theme.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ObservationLogCard({
  title,
  regionSubtitle,
  row,
  photoCount = 0,
}: ObservationLogCardProps) {
  const { theme } = useTheme();
  const si = getStarIndexScoreDisplay(row.starIndexVal);
  const weatherLabel = formatCloudForCard(row.weatherSnapshot);
  const timeLabel = formatObservationTimeKst(row.observedAt);

  return (
    <GlassCard padding={16} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Feather name="map-pin" size={16} color={theme.mutedForeground} style={styles.pin} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            {regionSubtitle ? (
              <Text
                style={[styles.region, { color: theme.mutedForeground }]}
                numberOfLines={1}
              >
                {regionSubtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <ResultBadge result={row.result} />
      </View>

      <View style={styles.metricsRow}>
        <MetricCell
          icon="calendar"
          label="관측일"
          value={formatObservationDateKst(row.observedAt)}
          valueColor={theme.foreground}
        />
        <MetricCell
          icon="star"
          label="Star-Index"
          value={formatStarIndexValue(row.starIndexVal)}
          valueColor={si.measurable ? theme.primaryGlow : theme.destructive}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          <Feather name="camera" size={14} color={theme.mutedForeground} />
          <Text style={[styles.footerMeta, { color: theme.mutedForeground }]}>
            {photoCount}장
          </Text>
          <Text style={[styles.footerTime, { color: theme.foreground }]}>{timeLabel}</Text>
        </View>
        <Text style={[styles.footerWeather, { color: theme.foreground }]} numberOfLines={1}>
          {weatherLabel}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  pin: {
    marginTop: 2,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  region: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  footerMeta: {
    fontSize: 12,
  },
  footerTime: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  footerWeather: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
  },
});

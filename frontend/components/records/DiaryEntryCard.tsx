/**
 * 일기 목록 카드 — 펼쳐보기 탭
 */

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../ui/AppPressable';
import type { ObservationRowDto } from '../../lib/api-client';
import { formatObservationPlaceLabel } from '../../lib/observation-place-label';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { GlassCard } from '../ui/GlassCard';

const RESULT_META: Record<
  ObservationRowDto['result'],
  { label: string; icon: React.ComponentProps<typeof Feather>['name']; colorKey: 'primaryGlow' | 'secondary' | 'destructive' }
> = {
  success: { label: '성공', icon: 'check-circle', colorKey: 'primaryGlow' },
  partial: { label: '부분', icon: 'minus-circle', colorKey: 'secondary' },
  fail: { label: '실패', icon: 'x-circle', colorKey: 'destructive' },
};

function formatDateKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
}

function previewText(content: string | null | undefined, max = 80): string {
  const t = (content ?? '').trim();
  if (!t) return '내용 없음';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export interface DiaryEntryCardProps {
  row: ObservationRowDto;
  onPress: () => void;
}

export function DiaryEntryCard({ row, onPress }: DiaryEntryCardProps) {
  const { theme } = useTheme();
  const meta = RESULT_META[row.result];
  const accent = theme[meta.colorKey];
  const si = getStarIndexScoreDisplay(row.starIndexVal);
  const cover = row.photos[0]?.imageUrl;
  const place = formatObservationPlaceLabel(row.placeLabel);

  return (
    <AppPressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <GlassCard padding={0} style={styles.card} glow>
        {cover ? (
          <View style={[styles.coverFrame, { backgroundColor: theme.inputBackground }]}>
            <Image source={{ uri: cover }} style={styles.cover} resizeMode="contain" />
          </View>
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: theme.inputBackground }]}>
            <Feather name="moon" size={28} color={theme.mutedForeground} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={[styles.date, { color: theme.mutedForeground }]}>
              {formatDateKst(row.observedAt)}
            </Text>
            <View style={[styles.badge, { borderColor: accent, backgroundColor: theme.primaryGlowMuted }]}>
              <Feather name={meta.icon} size={11} color={accent} />
              <Text style={[styles.badgeText, { color: accent }]}>{meta.label}</Text>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
            {row.title?.trim() || '제목 없음'}
          </Text>

          {place ? (
            <View style={styles.placeRow}>
              <Feather name="map-pin" size={12} color={theme.primaryGlow} />
              <Text style={[styles.placeText, { color: theme.mutedForeground }]} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.preview, { color: theme.mutedForeground }]} numberOfLines={2}>
            {previewText(row.content)}
          </Text>

          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Feather name="star" size={12} color={theme.primaryGlow} />
              <Text style={[styles.si, { color: si.measurable ? theme.primaryGlow : theme.destructive }]}>
                {si.label}
              </Text>
            </View>
            {row.photos.length > 0 ? (
              <View style={styles.footerLeft}>
                <Feather name="camera" size={12} color={theme.mutedForeground} />
                <Text style={[styles.photoCount, { color: theme.mutedForeground }]}>
                  {row.photos.length}장
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  coverFrame: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: { fontSize: 11, flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  placeText: { fontSize: 12, flex: 1 },
  preview: { fontSize: 13, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  si: { fontSize: 12, fontWeight: '600' },
  photoCount: { fontSize: 12 },
});

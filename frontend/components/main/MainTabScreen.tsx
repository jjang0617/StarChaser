import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import {
  authorizedGetJson,
  SessionExpiredError,
} from '../../lib/api-client';
import type {
  NotificationPreferenceDto,
  StarIndexResponseDto,
  WeeklyTop3ItemDto,
} from '../../lib/types/api';
import { MainHeaderIconButton } from './MainHeaderIconButton';
import { MainScoreGuideSheet } from './MainScoreGuideSheet';
import { MainStarIndexAlertSheet } from './MainStarIndexAlertSheet';
import { MainTop3Sheet } from './MainTop3Sheet';
import {
  formatCloudForCard,
  formatPm25Stat,
  getStarIndexScoreDisplay,
} from '../../lib/star-index-display';
import {
  getStarIndexHeadline,
  humidityLabelFromScore,
  windLabelFromScore,
} from '../../lib/star-index-headline';
import { formatObserverPlaceLabel } from '../../lib/observer-place-label';
import { formatStarIndexStaleHint } from '../../lib/star-index-stale';
import { AnimatedStarIndexGauge } from './AnimatedStarIndexGauge';

interface MainTabScreenProps {
  activeSpotId: string | null;
  observerLat?: number | null;
  observerLng?: number | null;
  starIndexData: StarIndexResponseDto | null;
  starIndexLoading: boolean;
  starIndexAwaitingLocation?: boolean;
  starIndexError: string | null;
  starIndexPlaceLabel: string | null;
  onReloadStarIndex: () => void;
  top3Loading: boolean;
  top3Error: string | null;
  top3Items: WeeklyTop3ItemDto[] | null;
  selectedSpotId: string | null;
  onSelectTop3Spot: (spotId: string) => void;
  onSessionInvalidated: () => void | Promise<void>;
}

function StatPill({
  caption,
  icon,
  primary,
  secondary,
}: {
  caption: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  primary: string;
  secondary?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statCaption, { color: theme.foreground }]} numberOfLines={1}>
        {caption}
      </Text>
      <Feather name={icon} size={15} color={theme.mutedForeground} style={{ opacity: 0.85 }} />
      <Text style={[styles.statPrimary, { color: theme.foreground }]} numberOfLines={1}>
        {primary}
      </Text>
      {secondary ? (
        <Text style={[styles.statSecondary, { color: theme.mutedForeground }]} numberOfLines={1}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

function MainLoadingHero() {
  const { theme } = useTheme();
  return (
    <>
      <View style={styles.headlineBlock}>
        <Text style={[styles.headlineLine1, { color: theme.foreground }]}>
          잠시만요,
        </Text>
        <Text style={[styles.headlineLine2, { color: theme.foreground }]}>
          <Text style={[styles.headlineHighlight, { color: theme.primaryGlow }]}>
            점수
          </Text>
          를 측정 중이에요
        </Text>
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          구름·미세먼지·달빛·바람을 살펴보고 있어요
        </Text>
      </View>
      <AnimatedStarIndexGauge loading />
    </>
  );
}

export function MainTabScreen({
  activeSpotId,
  observerLat = null,
  observerLng = null,
  starIndexData,
  starIndexLoading,
  starIndexAwaitingLocation = false,
  starIndexError,
  starIndexPlaceLabel,
  onReloadStarIndex,
  top3Loading,
  top3Error,
  top3Items,
  selectedSpotId,
  onSelectTop3Spot,
  onSessionInvalidated,
}: MainTabScreenProps) {
  const { theme } = useTheme();
  const [alertSheetOpen, setAlertSheetOpen] = useState(false);
  const [top3SheetOpen, setTop3SheetOpen] = useState(false);
  const [guideSheetOpen, setGuideSheetOpen] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);

  const refreshAlertBadge = useCallback(async () => {
    try {
      const prefs = await authorizedGetJson<NotificationPreferenceDto>(
        '/notifications/preferences',
      );
      setAlertEnabled(
        Boolean(prefs.alertsEnabled && prefs.locationStarIndexAlertEnabled),
      );
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
      }
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    void refreshAlertBadge();
  }, [refreshAlertBadge]);

  useEffect(() => {
    if (!alertSheetOpen) void refreshAlertBadge();
  }, [alertSheetOpen, refreshAlertBadge]);

  const hasObserverGps =
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng);
  const canLoad =
    Platform.OS !== 'web' || hasObserverGps || Boolean(activeSpotId);

  /** 데이터 없을 때는 에러 대신 측정 중 UI (앱 진입·리로드 시 spotId 선요청 깜빡임 방지) */
  const showLoading =
    canLoad &&
    !starIndexData &&
    (starIndexLoading || starIndexAwaitingLocation || Boolean(starIndexError));

  const locationLine = useMemo(() => {
    if (showLoading && !starIndexPlaceLabel) {
      return '위치 확인 중…';
    }
    const raw = starIndexPlaceLabel ?? starIndexData?.name;
    if (!raw) return '위치 확인 중…';
    return formatObserverPlaceLabel(raw);
  }, [showLoading, starIndexPlaceLabel, starIndexData?.name]);

  const headline = useMemo(
    () => getStarIndexHeadline(starIndexData?.score ?? 0),
    [starIndexData?.score],
  );

  const gaugeKey = starIndexData
    ? `${starIndexData.score}-${starIndexData.cachedAt ?? 'live'}`
    : 'empty';

  const weatherFooter = useMemo(() => {
    if (!starIndexData) return null;
    const snap = starIndexData.weatherSnapshot;
    const pm25 = formatPm25Stat(
      snap,
      starIndexData.display?.pm25?.trim(),
    );
    return {
      cloud: {
        primary: starIndexData.display?.cloud?.trim() || formatCloudForCard(snap),
      },
      wind: {
        primary: windLabelFromScore(snap.wind_score),
      },
      humidity: {
        primary: humidityLabelFromScore(snap.humidity_score),
      },
      pm25: {
        primary: pm25.value,
        secondary: pm25.grade,
      },
    };
  }, [starIndexData]);

  const siDisplay = starIndexData
    ? getStarIndexScoreDisplay(starIndexData.score)
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.primaryGlow }]} />
          <Text
            style={[styles.locationText, { color: theme.mutedForeground }]}
            numberOfLines={2}
          >
            {locationLine}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <MainHeaderIconButton
            icon="bell"
            active={alertEnabled}
            accessibilityLabel="Star-Index 알림 설정"
            onPress={() => setAlertSheetOpen(true)}
          />
          <MainHeaderIconButton
            icon="trending-up"
            accessibilityLabel="주간 TOP3 보기"
            onPress={() => setTop3SheetOpen(true)}
          />
          <MainHeaderIconButton
            icon="info"
            accessibilityLabel="Star-Index 점수 가이드"
            onPress={() => setGuideSheetOpen(true)}
          />
        </View>
      </View>

      <MainStarIndexAlertSheet
        visible={alertSheetOpen}
        onClose={() => setAlertSheetOpen(false)}
        onSessionInvalidated={onSessionInvalidated}
      />
      <MainTop3Sheet
        visible={top3SheetOpen}
        onClose={() => setTop3SheetOpen(false)}
        top3Loading={top3Loading}
        top3Error={top3Error}
        top3Items={top3Items}
        selectedSpotId={selectedSpotId}
        onSelectTop3Spot={onSelectTop3Spot}
      />
      <MainScoreGuideSheet
        visible={guideSheetOpen}
        onClose={() => setGuideSheetOpen(false)}
      />

      <View style={styles.hero}>
        {!canLoad ? (
          <View style={styles.messageBlock}>
            <Text style={[styles.headlineMuted, { color: theme.foreground }]}>
              위치·명소가 필요해요
            </Text>
            <Text style={[styles.hint, { color: theme.mutedForeground }]}>
              위치 권한을 허용하거나 지도에서 명소를 고르면 Star-Index를 불러옵니다.
            </Text>
          </View>
        ) : showLoading ? (
          <MainLoadingHero />
        ) : starIndexData && siDisplay ? (
          <>
            <View style={styles.headlineBlock}>
              <Text style={[styles.headlineLine1, { color: theme.foreground }]}>
                {headline.line1}
              </Text>
              <Text style={[styles.headlineLine2, { color: theme.foreground }]}>
                <Text style={[styles.headlineHighlight, { color: theme.primaryGlow }]}>
                  {headline.highlight}
                </Text>
                {headline.line2}
              </Text>
              <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                {headline.hint}
              </Text>
            </View>

            <AnimatedStarIndexGauge
              score={starIndexData.score}
              animateKey={gaugeKey}
            />

            {starIndexData.isStale ? (
              <Text style={[styles.staleHint, { color: theme.primaryGlow }]}>
                {formatStarIndexStaleHint(starIndexData.cachedAt)}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      {weatherFooter ? (
        <View style={[styles.footerStats, { borderTopColor: theme.borderSubtle }]}>
          <StatPill caption="구름" icon="cloud" primary={weatherFooter.cloud.primary} />
          <StatPill caption="바람" icon="wind" primary={weatherFooter.wind.primary} />
          <StatPill caption="습도" icon="droplet" primary={weatherFooter.humidity.primary} />
          <StatPill
            caption="미세먼지"
            icon="activity"
            primary={weatherFooter.pm25.primary}
            secondary={weatherFooter.pm25.secondary}
          />
        </View>
      ) : showLoading ? (
        <View style={[styles.footerStats, styles.footerSkeleton, { borderTopColor: theme.borderSubtle }]}>
          {(['구름', '바람', '습도', '미세먼지'] as const).map((label) => (
            <View key={label} style={styles.statPill}>
              <Text style={[styles.statCaption, { color: theme.foreground }]}>{label}</Text>
              <View style={[styles.skeletonIcon, { backgroundColor: theme.borderSubtle }]} />
              <View style={[styles.skeletonValue, { backgroundColor: theme.borderSubtle }]} />
            </View>
          ))}
        </View>
      ) : null}

      {canLoad && !starIndexLoading && starIndexData ? (
        <Pressable
          onPress={onReloadStarIndex}
          style={({ pressed }) => [styles.refreshTap, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Star-Index 새로고침"
        >
          <Text style={[styles.refreshText, { color: theme.mutedForeground }]}>
            탭하여 갱신
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  locationText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  headlineBlock: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    maxWidth: 340,
  },
  headlineLine1: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headlineLine2: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 34,
  },
  headlineHighlight: {
    fontWeight: '700',
  },
  headlineMuted: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
  messageBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  staleHint: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.lg,
  },
  footerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    gap: 4,
  },
  footerSkeleton: {
    opacity: 0.55,
  },
  statPill: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  statCaption: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    opacity: 0.42,
    textAlign: 'center',
  },
  statPrimary: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statSecondary: {
    fontSize: 11,
    textAlign: 'center',
  },
  skeletonIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  skeletonValue: {
    width: 36,
    height: 10,
    borderRadius: 4,
    marginTop: 2,
  },
  refreshTap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  refreshText: {
    fontSize: 11,
  },
});

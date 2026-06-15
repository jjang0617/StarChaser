import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { dangerAccent } from '../../themes/themes';
import { useTheme } from '../../themes/ThemeContext';
import {
  fetchNotificationHistory,
  SessionExpiredError,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { MainHeaderIconButton } from './MainHeaderIconButton';
import { MainNotificationHistorySheet } from './MainNotificationHistorySheet';
import { MainScoreGuideSheet } from './MainScoreGuideSheet';
import { MainWeatherStatsGuideSheet, type WeatherStatType } from './MainWeatherStatsGuideSheet';
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
import {
  formatLastRefreshLabel,
  formatStarIndexStaleHint,
  msUntilNextRefreshLabelChange,
} from '../../lib/star-index-stale';
import type { ObserverLocationUnavailable } from '../../lib/use-observer-star-index';
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
  locationUnavailable?: ObserverLocationUnavailable | null;
  starIndexRefreshing?: boolean;
  starIndexLastRefreshedAt?: number | null;
  starIndexRefreshFeedback?: { tone: 'success' | 'error'; message: string } | null;
  onReloadStarIndex: () => void;
  onSessionInvalidated: () => void | Promise<void>;
}

function StatPill({
  caption,
  icon,
  primary,
  secondary,
  unknown = false,
  onPress,
}: {
  caption: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  primary: string;
  secondary?: string;
  unknown?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const content = (
    <View style={styles.statPill}>
      <Text style={[styles.statCaption, { color: theme.foreground }]} numberOfLines={1}>
        {caption}
      </Text>
      <Feather
        name={icon}
        size={15}
        color={theme.mutedForeground}
        style={{ opacity: unknown ? 0.45 : 0.85 }}
      />
      <Text
        style={[
          unknown ? styles.statUnknown : styles.statPrimary,
          { color: unknown ? theme.mutedForeground : theme.foreground },
        ]}
        numberOfLines={1}
      >
        {primary}
      </Text>
      {secondary ? (
        <Text style={[styles.statSecondary, { color: theme.mutedForeground }]} numberOfLines={1}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        {content}
      </Pressable>
    );
  }
  return content;
}

function formatSunState(sunAlt: number | undefined | null, refDate?: Date): string {
  if (sunAlt == null || !Number.isFinite(sunAlt)) return '-';
  if (sunAlt <= -18) return '밤';

  const date = refDate || new Date();
  const hour = date.getHours();
  const suffix = hour < 12 ? '여명' : '황혼';

  if (sunAlt <= -12) return `천문${suffix}`;
  if (sunAlt <= -6) return `해양${suffix}`;
  if (sunAlt < 0) return `시민${suffix}`;
  return '낮';
}

function formatMoonPhase(phase: number | undefined | null): string {
  if (phase == null || !Number.isFinite(phase)) return '';
  if (phase < 0.06 || phase > 0.94) return '삭';
  if (phase < 0.22) return '초승달';
  if (phase < 0.28) return '상현달';
  if (phase < 0.44) return '차오르는달';
  if (phase < 0.56) return '보름달';
  if (phase < 0.72) return '이우는달';
  if (phase < 0.78) return '하현달';
  return '그믐달';
}

function MainLocationUnavailableHero({
  mode,
}: {
  mode: ObserverLocationUnavailable;
}) {
  const { theme } = useTheme();
  const isPermission = mode === 'permission';
  return (
    <>
      <View style={styles.headlineBlock}>
        <Text style={[styles.headlineLine1, { color: theme.foreground }]}>
          {isPermission
            ? '위치 권한이 허용되지 않아'
            : '앱에서 위치 사용이 꺼져 있어'}
        </Text>
        <Text style={[styles.headlineLine2, { color: theme.foreground }]}>
          <Text style={[styles.headlineHighlight, { color: theme.primaryGlow }]}>
            점수
          </Text>
          를 측정할 수 없어요
        </Text>
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          {isPermission
            ? '마이페이지(ME) 또는 시스템 설정에서\n위치 권한을 허용해 주세요.'
            : '마이페이지(ME)에서 위치 사용을 켜 주세요.'}
        </Text>
      </View>
      <AnimatedStarIndexGauge unknown />
    </>
  );
}

function MainUnknownStatsFooter({
  onPressStat,
}: {
  onPressStat?: (stat: WeatherStatType) => void;
}) {
  const { theme } = useTheme();
  const items = [
    { type: 'sun' as const, caption: '태양고도', icon: 'sun' as const },
    { type: 'lightPollution' as const, caption: '빛공해', icon: 'zap' as const },
    { type: 'cloud' as const, caption: '구름', icon: 'cloud' as const },
    { type: 'moon' as const, caption: '달고도', icon: 'moon' as const },
    { type: 'humidity' as const, caption: '습도', icon: 'droplet' as const },
    { type: 'pm25' as const, caption: '미세먼지', icon: 'activity' as const },
  ];
  return (
    <View style={[styles.footerStats, { borderTopColor: theme.borderSubtle }]}>
      <View style={styles.footerStatsRow}>
        {items.slice(0, 3).map(({ type, caption, icon }) => (
          <StatPill
            key={caption}
            caption={caption}
            icon={icon}
            primary="?"
            unknown
            onPress={onPressStat ? () => onPressStat(type) : undefined}
          />
        ))}
      </View>
      <View style={[styles.footerRowDivider, { backgroundColor: theme.borderSubtle }]} />
      <View style={styles.footerStatsRow}>
        {items.slice(3, 6).map(({ type, caption, icon }) => (
          <StatPill
            key={caption}
            caption={caption}
            icon={icon}
            primary="?"
            unknown
            onPress={onPressStat ? () => onPressStat(type) : undefined}
          />
        ))}
      </View>
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
          하늘 조건을 확인하고 있어요
        </Text>
      </View>
      <AnimatedStarIndexGauge loading />
    </>
  );
}

function MainFetchErrorHero({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { theme } = useTheme();
  return (
    <>
      <View style={styles.headlineBlock}>
        <Text style={[styles.headlineLine1, { color: theme.foreground }]}>
          점수를 불러오지
        </Text>
        <Text style={[styles.headlineLine2, { color: theme.foreground }]}>
          <Text style={[styles.headlineHighlight, { color: theme.destructive }]}>
            못했어요
          </Text>
        </Text>
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>{message}</Text>
      </View>
      <AnimatedStarIndexGauge unknown />
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="다시 측정"
      >
        <Text style={[styles.retryBtnText, { color: theme.primaryGlow }]}>다시 시도</Text>
      </Pressable>
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
  locationUnavailable = null,
  starIndexRefreshing = false,
  starIndexLastRefreshedAt = null,
  starIndexRefreshFeedback = null,
  onReloadStarIndex,
  onSessionInvalidated,
}: MainTabScreenProps) {
  const { theme, isRedMode } = useTheme();
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [guideSheetOpen, setGuideSheetOpen] = useState(false);
  const [statsGuideOpen, setStatsGuideOpen] = useState(false);
  const [activeGuideStat, setActiveGuideStat] = useState<WeatherStatType>('sun');

  const openStatsGuide = useCallback((stat: WeatherStatType) => {
    setActiveGuideStat(stat);
    setStatsGuideOpen(true);
  }, []);
  const [alertEnabled, setAlertEnabled] = useState(false);
  /** 마지막 갱신 시각 라벨이 경과에 맞게 바뀌도록 주기적 리렌더 */
  const [refreshLabelTick, setRefreshLabelTick] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    if (starIndexLastRefreshedAt == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const delay = msUntilNextRefreshLabelChange(starIndexLastRefreshedAt);
      if (delay == null || cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        setRefreshLabelTick((t) => t + 1);
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [starIndexLastRefreshedAt]);

  const lastRefreshLabel = useMemo(() => {
    void refreshLabelTick;
    return starIndexLastRefreshedAt != null
      ? formatLastRefreshLabel(starIndexLastRefreshedAt)
      : null;
  }, [starIndexLastRefreshedAt, refreshLabelTick]);

  const refreshUnreadBadge = useCallback(async () => {
    try {
      const data = await fetchNotificationHistory({ limit: 1 });
      setHasUnreadNotifications(data.unreadCount > 0);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
      }
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    void refreshUnreadBadge();
  }, [refreshUnreadBadge]);

  useEffect(() => {
    if (!historySheetOpen) void refreshUnreadBadge();
  }, [historySheetOpen, refreshUnreadBadge]);

  const hasObserverGps =
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng);
  const canLoad =
    Platform.OS === 'web'
      ? hasObserverGps || Boolean(activeSpotId)
      : true;

  const showLocationUnavailable =
    canLoad &&
    locationUnavailable != null &&
    !hasObserverGps &&
    !starIndexData &&
    !starIndexLoading &&
    !starIndexAwaitingLocation;

  /** 데이터 없을 때는 측정 중 UI — 겹친 reload·silent 재시도 사이 빈 화면도 측정 중으로 처리 */
  const showLoading =
    canLoad &&
    !showLocationUnavailable &&
    !starIndexData &&
    (starIndexLoading ||
      starIndexAwaitingLocation ||
      !starIndexError);

  const showFetchError =
    canLoad &&
    !showLocationUnavailable &&
    !starIndexData &&
    !showLoading &&
    Boolean(starIndexError);

  const locationLine = useMemo(() => {
    if (showLocationUnavailable && locationUnavailable) {
      return locationUnavailable === 'permission'
        ? '위치 권한이 허용되지 않음'
        : '앱에서 위치 사용 꺼짐';
    }
    if (showLoading && !starIndexPlaceLabel) {
      return '위치 확인 중…';
    }
    const raw = starIndexPlaceLabel ?? starIndexData?.name;
    if (!raw) return '위치 확인 중…';
    return formatObserverPlaceLabel(raw);
  }, [
    showLocationUnavailable,
    locationUnavailable,
    showLoading,
    starIndexPlaceLabel,
    starIndexData?.name,
  ]);

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
      sun: {
        primary: snap.sun_altitude_deg != null ? `${Math.round(snap.sun_altitude_deg)}°` : '-',
        secondary: formatSunState(
          snap.sun_altitude_deg,
          starIndexData.cachedAt ? new Date(starIndexData.cachedAt) : new Date()
        ),
      },
      lightPollution: {
        primary: `Bortle ${starIndexData.bortleClass}급`,
        secondary: snap.light_pollution_score != null ? `${Math.round(snap.light_pollution_score)}점` : undefined,
      },
      cloud: {
        primary: starIndexData.display?.cloud?.trim() || formatCloudForCard(snap),
        secondary: snap.cloud_cover_pct != null ? `${snap.cloud_cover_pct}%` : undefined,
      },
      moon: {
        primary: snap.moon_altitude_deg != null && snap.moon_altitude_known !== false
          ? `${Math.round(snap.moon_altitude_deg)}°`
          : '-',
        secondary: formatMoonPhase(snap.lun_phase),
      },
      humidity: {
        primary: humidityLabelFromScore(snap.humidity_score),
        secondary: snap.humidity_score != null ? `${Math.round(snap.humidity_score)}점` : undefined,
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

  const headlineHighlightColor =
    siDisplay && !siDisplay.measurable
      ? dangerAccent(theme, isRedMode).title
      : theme.primaryGlow;

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.locationRow}>
          <View
            style={[
              styles.locationDot,
              {
                backgroundColor: showLocationUnavailable
                  ? theme.mutedForeground
                  : theme.primaryGlow,
                opacity: showLocationUnavailable ? 0.55 : 1,
              },
            ]}
          />
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
            active={hasUnreadNotifications}
            accessibilityLabel="알림 내역"
            onPress={() => setHistorySheetOpen(true)}
          />
          <MainHeaderIconButton
            icon="info"
            accessibilityLabel="Star-Index 점수 가이드"
            onPress={() => setGuideSheetOpen(true)}
          />
        </View>
      </View>

      <MainNotificationHistorySheet
        visible={historySheetOpen}
        onClose={() => setHistorySheetOpen(false)}
        onSessionInvalidated={onSessionInvalidated}
        onReadStateChanged={() => setHasUnreadNotifications(false)}
      />
      <MainScoreGuideSheet
        visible={guideSheetOpen}
        onClose={() => setGuideSheetOpen(false)}
      />
      <MainWeatherStatsGuideSheet
        visible={statsGuideOpen}
        onClose={() => setStatsGuideOpen(false)}
        initialStat={activeGuideStat}
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
        ) : showLocationUnavailable && locationUnavailable ? (
          <MainLocationUnavailableHero mode={locationUnavailable} />
        ) : showLoading ? (
          <MainLoadingHero />
        ) : showFetchError && starIndexError ? (
          <MainFetchErrorHero
            message={starIndexError}
            onRetry={onReloadStarIndex}
          />
        ) : starIndexData && siDisplay ? (
          <>
            <View style={styles.headlineBlock}>
              <Text style={[styles.headlineLine1, { color: theme.foreground }]}>
                {headline.line1}
              </Text>
              <Text style={[styles.headlineLine2, { color: theme.foreground }]}>
                <Text
                  style={[styles.headlineHighlight, { color: headlineHighlightColor }]}
                >
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

            {canLoad && starIndexData ? (
              <Pressable
                onPress={onReloadStarIndex}
                disabled={starIndexRefreshing}
                style={({ pressed }) => [
                  styles.refreshTap,
                  starIndexRefreshing && styles.refreshTapBusy,
                  pressed && !starIndexRefreshing && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  starIndexRefreshing ? 'Star-Index 갱신 중' : 'Star-Index 새로고침'
                }
                accessibilityState={{ busy: starIndexRefreshing }}
              >
                {starIndexRefreshing ? (
                  <View style={styles.refreshRow}>
                    <ActivityIndicator size="small" color={theme.primaryGlow} />
                    <Text style={[styles.refreshText, { color: theme.primaryGlow }]}>
                      갱신 중…
                    </Text>
                  </View>
                ) : starIndexRefreshFeedback?.tone === 'error' ? (
                  <Text style={[styles.refreshText, { color: theme.destructive }]}>
                    {starIndexRefreshFeedback.message}
                  </Text>
                ) : starIndexRefreshFeedback?.tone === 'success' ? (
                  <View style={styles.refreshCol}>
                    <Text style={[styles.refreshText, { color: theme.primaryGlow }]}>
                      탭하여 갱신
                    </Text>
                    <Text style={[styles.refreshSubText, { color: theme.primaryGlow }]}>
                      {starIndexRefreshFeedback.message}
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
          </>
        ) : null}
      </View>

      {showLocationUnavailable ? (
        <MainUnknownStatsFooter onPressStat={openStatsGuide} />
      ) : weatherFooter ? (
        <View style={[styles.footerStats, { borderTopColor: theme.borderSubtle }]}>
          <View style={styles.footerStatsRow}>
            <StatPill
              caption="태양고도"
              icon="sun"
              primary={weatherFooter.sun.primary}
              secondary={weatherFooter.sun.secondary}
              onPress={() => openStatsGuide('sun')}
            />
            <StatPill
              caption="빛공해"
              icon="zap"
              primary={weatherFooter.lightPollution.primary}
              secondary={weatherFooter.lightPollution.secondary}
              onPress={() => openStatsGuide('lightPollution')}
            />
            <StatPill
              caption="구름"
              icon="cloud"
              primary={weatherFooter.cloud.primary}
              secondary={weatherFooter.cloud.secondary}
              onPress={() => openStatsGuide('cloud')}
            />
          </View>
          <View style={[styles.footerRowDivider, { backgroundColor: theme.borderSubtle }]} />
          <View style={styles.footerStatsRow}>
            <StatPill
              caption="달고도"
              icon="moon"
              primary={weatherFooter.moon.primary}
              secondary={weatherFooter.moon.secondary}
              onPress={() => openStatsGuide('moon')}
            />
            <StatPill
              caption="습도"
              icon="droplet"
              primary={weatherFooter.humidity.primary}
              secondary={weatherFooter.humidity.secondary}
              onPress={() => openStatsGuide('humidity')}
            />
            <StatPill
              caption="미세먼지"
              icon="activity"
              primary={weatherFooter.pm25.primary}
              secondary={weatherFooter.pm25.secondary}
              onPress={() => openStatsGuide('pm25')}
            />
          </View>
        </View>
      ) : showLoading || showFetchError ? (
        <View style={[styles.footerStats, styles.footerSkeleton, { borderTopColor: theme.borderSubtle }]}>
          <View style={styles.footerStatsRow}>
            {(['태양고도', '빛공해', '구름'] as const).map((label) => {
              const iconMap = {
                태양고도: 'sun' as const,
                빛공해: 'zap' as const,
                구름: 'cloud' as const,
              };
              return (
                <View key={label} style={styles.statPill}>
                  <Text style={[styles.statCaption, { color: theme.foreground }]}>{label}</Text>
                  <Feather name={iconMap[label]} size={15} color={theme.borderSubtle} style={{ opacity: 0.3 }} />
                  <View style={[styles.skeletonValue, { backgroundColor: theme.borderSubtle }]} />
                </View>
              );
            })}
          </View>
          <View style={[styles.footerRowDivider, { backgroundColor: theme.borderSubtle }]} />
          <View style={styles.footerStatsRow}>
            {(['달고도', '습도', '미세먼지'] as const).map((label) => {
              const iconMap = {
                달고도: 'moon' as const,
                습도: 'droplet' as const,
                미세먼지: 'activity' as const,
              };
              return (
                <View key={label} style={styles.statPill}>
                  <Text style={[styles.statCaption, { color: theme.foreground }]}>{label}</Text>
                  <Feather name={iconMap[label]} size={15} color={theme.borderSubtle} style={{ opacity: 0.3 }} />
                  <View style={[styles.skeletonValue, { backgroundColor: theme.borderSubtle }]} />
                </View>
              );
            })}
          </View>
        </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    flexDirection: 'column',
    gap: 8,
  },
  footerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
  },
  footerRowDivider: {
    height: 1,
    marginVertical: 4,
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
  statUnknown: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'SpaceMono-Regular',
    opacity: 0.62,
    letterSpacing: 0.5,
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
    minHeight: 28,
    justifyContent: 'center',
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
    gap: 2,
  },
  refreshText: {
    fontSize: 11,
  },
  refreshSubText: {
    fontSize: 10,
    opacity: 0.85,
  },
  retryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

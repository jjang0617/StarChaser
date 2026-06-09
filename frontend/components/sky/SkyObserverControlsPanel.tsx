import * as Location from 'expo-location';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StarIndexResponseDto } from '../../lib/types/api';
import type { StarIndexScoreDisplay } from '../../lib/star-index-display';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';
import { GlassCard } from '../ui/GlassCard';

function PanelDivider({ borderColor }: { borderColor: string }) {
  return (
    <View
      style={[styles.divider, { backgroundColor: borderColor }]}
      accessibilityElementsHidden
    />
  );
}

function PanelSection({
  title,
  children,
  titleColor,
}: {
  title: string;
  children: React.ReactNode;
  titleColor: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      {children}
    </View>
  );
}

function ScoreBlock({
  display,
  loading,
  error,
}: {
  display: StarIndexScoreDisplay | null;
  loading: boolean;
  error: string | null;
}) {
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={styles.scoreRow}>
        <ActivityIndicator size="small" color={theme.primaryGlow} />
        <Text style={[styles.scoreHint, { color: theme.mutedForeground }]}>
          불러오는 중…
        </Text>
      </View>
    );
  }
  if (error) {
    return (
      <Text style={[styles.scoreErr, { color: theme.destructive }]} numberOfLines={2}>
        {error}
      </Text>
    );
  }
  if (!display) {
    return (
      <Text style={[styles.scoreHint, { color: theme.mutedForeground }]}>—</Text>
    );
  }

  return (
    <View style={styles.scoreRow}>
      <Text
        style={[
          styles.scoreValue,
          { color: display.measurable ? theme.starGold : theme.destructive },
        ]}
      >
        {display.label}
      </Text>
      <Text style={[styles.scoreUnit, { color: theme.mutedForeground }]}>
        / 100
      </Text>
    </View>
  );
}

export type SkyObserverControlsPanelProps = {
  top: number;
  maxWidth: number;
  panelBottomInset?: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  kstHmCompact: string;
  kstShort: string;
  obsLat: number;
  obsLng: number;
  skyUsesGps: boolean;
  usesSpotFallback: boolean;
  placeName: string | null;
  locationFeaturesEnabled: boolean;
  locationPermissionStatus: Location.PermissionResponse['status'] | null;
  locationDenied: boolean;
  onRequestLocationPermission?: () => void;
  locSiLoading: boolean;
  locSiErr: string | null;
  locSiDisplay: StarIndexScoreDisplay | null;
  locStarIndex: StarIndexResponseDto | null;
  onShiftHours: (delta: number) => void;
  onObserveNow: () => void;
  alignHeading: boolean;
  motionAssist: boolean;
  onToggleAlignHeading: () => void;
  onToggleMotionAssist: () => void;
  viewIsDefault: boolean;
  onResetView: () => void;
  renderEngine: 'svg' | 'gl';
  onSelectRenderEngine: (mode: 'svg' | 'gl') => void;
  onRefreshSky: () => void;
  skyLoading: boolean;
  headingDeg: number | null;
  headingErr: string | null;
  showDevRenderBadge?: boolean;
};

export function SkyObserverControlsPanel({
  top,
  maxWidth,
  panelBottomInset = 0,
  expanded,
  onToggleExpanded,
  kstHmCompact,
  kstShort,
  obsLat,
  obsLng,
  skyUsesGps,
  usesSpotFallback,
  placeName,
  locationFeaturesEnabled,
  locationPermissionStatus,
  locationDenied,
  onRequestLocationPermission,
  locSiLoading,
  locSiErr,
  locSiDisplay,
  onShiftHours,
  onObserveNow,
  alignHeading,
  motionAssist,
  onToggleAlignHeading,
  onToggleMotionAssist,
  viewIsDefault,
  onResetView,
  renderEngine,
  onSelectRenderEngine,
  onRefreshSky,
  skyLoading,
  headingDeg,
  headingErr,
  showDevRenderBadge = false,
}: SkyObserverControlsPanelProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dividerColor = theme.borderSubtle;

  const expandedMaxHeight = useMemo(() => {
    const h = Dimensions.get('window').height;
    const tabReserve = 56 + Math.max(insets.bottom, panelBottomInset, 12);
    return Math.max(160, h - top - tabReserve - 24);
  }, [top, insets.bottom, panelBottomInset]);

  const coordSource = skyUsesGps
    ? 'GPS'
    : usesSpotFallback
      ? '명소'
      : '좌표';

  const showLocationPrompt =
    Platform.OS !== 'web' &&
    locationFeaturesEnabled &&
    locationPermissionStatus != null &&
    locationPermissionStatus !== Location.PermissionStatus.GRANTED;

  return (
    <View style={[styles.float, { top, left: spacing.sm, maxWidth }]} pointerEvents="auto">
      <GlassCard glow padding={expanded ? 10 : 8} style={styles.card}>
        <Pressable
          onPress={onToggleExpanded}
          style={({ pressed }) => [
            styles.headerRow,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? '천구 패널 접기' : '천구 패널 펼치기'}
        >
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            천구 · 관측
          </Text>
          <View
            style={[
              styles.chevronWrap,
              { backgroundColor: theme.primaryGlowMuted, borderColor: theme.primaryGlowBorder },
            ]}
          >
            <Text style={[styles.chevron, { color: theme.starGold }]}>
              {expanded ? '▼' : '▶'}
            </Text>
          </View>
        </Pressable>

        {!expanded ? (
          <View style={styles.compact}>
            <Text style={[styles.compactTime, { color: theme.foreground }]}>
              {kstHmCompact} KST
            </Text>
            {locSiLoading ? (
              <Text style={[styles.compactMeta, { color: theme.mutedForeground }]}>…</Text>
            ) : locSiDisplay ? (
              <Text
                style={[
                  styles.compactMeta,
                  {
                    color: locSiDisplay.measurable
                      ? theme.starGold
                      : theme.destructive,
                  },
                ]}
              >
                {locSiDisplay.label}
              </Text>
            ) : locSiErr ? (
              <Text style={[styles.compactMeta, { color: theme.destructive }]}>오류</Text>
            ) : (
              <Text style={[styles.compactMeta, { color: theme.mutedForeground }]}>—</Text>
            )}
            {showDevRenderBadge ? (
              <Text style={[styles.compactMeta, { color: theme.mutedForeground }]}>
                {renderEngine === 'svg' ? 'SVG' : 'GL'}
              </Text>
            ) : null}
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: expandedMaxHeight }}
            contentContainerStyle={styles.expandedScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <PanelSection title="관측 시각" titleColor={theme.mutedForeground}>
              <Text style={[styles.kstFull, { color: theme.foreground }]} numberOfLines={2}>
                {kstShort}
              </Text>
              <Text style={[styles.kstBadge, { color: theme.mutedForeground }]}>KST</Text>
            </PanelSection>

            <PanelDivider borderColor={dividerColor} />

            <PanelSection title="현재 좌표" titleColor={theme.mutedForeground}>
              <View style={styles.coordRow}>
                <View
                  style={[
                    styles.coordBadge,
                    {
                      backgroundColor: theme.primaryGlowMuted,
                      borderColor: theme.primaryGlowBorder,
                    },
                  ]}
                >
                  <Text style={[styles.coordBadgeText, { color: theme.primaryGlow }]}>
                    {coordSource}
                  </Text>
                </View>
                <Text style={[styles.coordLine, { color: theme.foreground }]}>
                  {obsLat.toFixed(4)} · {obsLng.toFixed(4)}
                </Text>
              </View>
              {placeName ? (
                <Text
                  style={[styles.placeName, { color: theme.mutedForeground }]}
                  numberOfLines={1}
                >
                  {placeName}
                </Text>
              ) : null}
            </PanelSection>

            {showLocationPrompt ? (
              <>
                <PanelDivider borderColor={dividerColor} />
                <View style={styles.locationPrompt}>
                  <Text style={[styles.coordHint, { color: theme.mutedForeground }]}>
                    위치 허용 시 현재 좌표 기준
                  </Text>
                  {!locationDenied ? (
                    <Button
                      label="위치 허용"
                      variant="secondary"
                      size="sm"
                      onPress={() => void onRequestLocationPermission?.()}
                    />
                  ) : (
                    <Button
                      label="설정 열기"
                      variant="outline"
                      size="sm"
                      onPress={() => void Linking.openSettings()}
                    />
                  )}
                </View>
              </>
            ) : null}

            <PanelDivider borderColor={dividerColor} />

            <PanelSection title="Star-Index" titleColor={theme.mutedForeground}>
              <ScoreBlock
                display={locSiDisplay}
                loading={locSiLoading}
                error={locSiErr}
              />
            </PanelSection>

            <PanelDivider borderColor={dividerColor} />

            <PanelSection title="시각" titleColor={theme.mutedForeground}>
              <View style={styles.timeBtnGrid}>
                <Button label="−6h" variant="outline" size="sm" onPress={() => onShiftHours(-6)} />
                <Button label="−1h" variant="outline" size="sm" onPress={() => onShiftHours(-1)} />
                <Button label="지금" variant="secondary" size="sm" onPress={onObserveNow} />
                <Button label="+1h" variant="outline" size="sm" onPress={() => onShiftHours(1)} />
                <Button label="+6h" variant="outline" size="sm" onPress={() => onShiftHours(6)} />
              </View>
            </PanelSection>

            <PanelDivider borderColor={dividerColor} />

            <PanelSection title="시야 · 방위" titleColor={theme.mutedForeground}>
              <View style={styles.rowWrap}>
                <Button
                  label={alignHeading ? '방위 끔' : '방위'}
                  variant={alignHeading ? 'secondary' : 'outline'}
                  size="sm"
                  onPress={onToggleAlignHeading}
                />
                <Button
                  label={motionAssist ? '자이로 끔' : '자이로'}
                  variant={motionAssist ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={!alignHeading}
                  onPress={onToggleMotionAssist}
                />
                <Button
                  label="원위치"
                  variant="outline"
                  size="sm"
                  disabled={viewIsDefault}
                  onPress={onResetView}
                />
              </View>
              {alignHeading && headingDeg != null && Platform.OS !== 'web' ? (
                <Text style={[styles.coordHint, { color: theme.mutedForeground }]}>
                  {headingDeg.toFixed(0)}°{motionAssist ? ' · 자이로' : ''}
                </Text>
              ) : null}
              {headingErr ? (
                <Text style={[styles.scoreErr, { color: theme.destructive }]}>{headingErr}</Text>
              ) : null}
            </PanelSection>

            {showDevRenderBadge ? (
              <>
                <PanelDivider borderColor={dividerColor} />
                <PanelSection title="렌더" titleColor={theme.mutedForeground}>
                  <View
                    style={[
                      styles.renderModeRow,
                      { borderColor: theme.borderSubtle, backgroundColor: theme.card },
                    ]}
                  >
                    <Pressable
                      onPress={() => onSelectRenderEngine('svg')}
                      style={({ pressed }) => [
                        styles.renderModeSeg,
                        renderEngine === 'svg' && {
                          backgroundColor: theme.input,
                          borderColor: theme.starGold,
                        },
                        { borderColor: theme.borderSubtle },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text style={[styles.renderModeTitle, { color: theme.foreground }]}>
                        SVG
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={Platform.OS === 'web'}
                      onPress={() => onSelectRenderEngine('gl')}
                      style={({ pressed }) => [
                        styles.renderModeSeg,
                        renderEngine === 'gl' && {
                          backgroundColor: theme.input,
                          borderColor: theme.starGold,
                        },
                        { borderColor: theme.borderSubtle },
                        Platform.OS === 'web' && { opacity: 0.45 },
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <Text style={[styles.renderModeTitle, { color: theme.foreground }]}>
                        GL
                      </Text>
                    </Pressable>
                  </View>
                </PanelSection>
              </>
            ) : null}

            <Button
              label="새로고침"
              variant="ghost"
              size="sm"
              onPress={onRefreshSky}
              disabled={skyLoading}
              style={{ marginTop: 6, alignSelf: 'flex-start' }}
            />
          </ScrollView>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    zIndex: 5,
  },
  card: {
    maxWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 10,
    fontWeight: '700',
  },
  compact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  compactTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  compactMeta: {
    fontSize: 9,
    fontWeight: '500',
  },
  expandedScroll: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: 7,
    opacity: 0.5,
  },
  kstFull: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  kstBadge: {
    fontSize: 9,
    marginTop: 1,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  coordBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  coordBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  coordLine: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  placeName: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  coordHint: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  locationPrompt: {
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  scoreUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  scoreHint: {
    fontSize: 10,
  },
  scoreErr: {
    fontSize: 10,
    lineHeight: 14,
  },
  timeBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  renderModeRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    padding: 3,
    gap: 3,
  },
  renderModeSeg: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: 'center',
  },
  renderModeTitle: { fontSize: 10, fontWeight: '700' },
});

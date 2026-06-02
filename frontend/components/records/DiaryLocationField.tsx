import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiRequestError,
  fetchStarIndex,
  fetchStarIndexAtLocation,
  SessionExpiredError,
} from '../../lib/api-client';
import { fetchSpotsSearch } from '../../lib/spots-api';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { MeasuringDots } from '../main/AnimatedStarIndexGauge';
import type { StarIndexResponseDto, SpotDto } from '../../lib/types/api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { DiaryLocationCustomModal } from './DiaryLocationCustomModal';

export type DiaryLocationMode = 'current' | 'spot' | 'custom';

export interface DiaryLocationValue {
  mode: DiaryLocationMode;
  spotId: string | null;
  label: string;
  starIndex: StarIndexResponseDto;
  customLat?: number;
  customLng?: number;
}

interface DiaryLocationFieldProps {
  value: DiaryLocationValue;
  onChange: (next: DiaryLocationValue) => void;
  observerLat?: number | null;
  observerLng?: number | null;
  placeLabel?: string | null;
  disabled?: boolean;
  onSessionInvalidated: () => Promise<void>;
}

const SEARCH_DEBOUNCE_MS = 320;

function hasCoords(lat?: number | null, lng?: number | null): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

function spotListLabel(spot: SpotDto): string {
  const short = spotNameWithoutRegionPrefix(spot.name);
  return short || spot.name;
}

function LocationScoreBadge({
  starIndex,
  loading,
}: {
  starIndex?: StarIndexResponseDto;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  if (loading) {
    return (
      <View style={badgeStyles.wrap}>
        <Text style={[badgeStyles.measuringCaption, { color: theme.mutedForeground }]}>
          측정 중
        </Text>
        <MeasuringDots color={theme.primaryGlow} />
      </View>
    );
  }
  if (!starIndex) return null;
  const display = getStarIndexScoreDisplay(starIndex.score);
  return (
    <View style={badgeStyles.wrap}>
      <Text style={[badgeStyles.caption, { color: theme.mutedForeground }]}>Star-Index</Text>
      <Text
        style={[
          badgeStyles.score,
          {
            color: display.measurable ? theme.primaryGlow : theme.destructive,
            fontFamily: 'SpaceMono-Regular',
          },
        ]}
      >
        {display.label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', minWidth: 56 },
  measuringCaption: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  caption: { fontSize: 10, letterSpacing: 0.3, marginBottom: 2 },
  score: { fontSize: 20, lineHeight: 24, fontWeight: '600' },
});

export function DiaryLocationField({
  value,
  onChange,
  observerLat,
  observerLng,
  placeLabel,
  disabled = false,
  onSessionInvalidated,
}: DiaryLocationFieldProps) {
  const { theme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const coordsReady = hasCoords(observerLat, observerLng);
  const scoreDisplay = getStarIndexScoreDisplay(value.starIndex.score);

  useEffect(() => {
    if (!pickerOpen) return;
    setSearchQuery('');
    setSearchResults([]);
    setSearchErr(null);
    setHasSearched(false);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const q = searchQuery.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      setHasSearched(false);
      return;
    }

    const seq = ++searchSeq.current;
    setSearchLoading(true);
    setSearchErr(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await fetchSpotsSearch(q, 50);
          if (searchSeq.current !== seq) return;
          setSearchResults(rows);
          setHasSearched(true);
        } catch (e) {
          if (searchSeq.current !== seq) return;
          if (e instanceof SessionExpiredError) {
            await onSessionInvalidated();
            return;
          }
          setSearchErr(
            e instanceof ApiRequestError ? e.message : '명소 검색에 실패했습니다.',
          );
          setSearchResults([]);
          setHasSearched(true);
        } finally {
          if (searchSeq.current === seq) setSearchLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, pickerOpen, onSessionInvalidated]);

  const applyCurrent = useCallback(async () => {
    setSwitching(true);
    setSwitchErr(null);
    try {
      let starIndex = value.starIndex;
      if (coordsReady) {
        starIndex = await fetchStarIndexAtLocation(observerLat!, observerLng!);
      }
      const label = placeLabel?.trim() || starIndex.name || '현재 위치';
      onChange({
        mode: 'current',
        spotId: null,
        label,
        starIndex,
      });
      setPickerOpen(false);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setSwitchErr(
        e instanceof ApiRequestError ? e.message : '위치 정보를 불러오지 못했습니다.',
      );
    } finally {
      setSwitching(false);
    }
  }, [
    coordsReady,
    observerLat,
    observerLng,
    onChange,
    onSessionInvalidated,
    placeLabel,
    value.starIndex,
  ]);

  const applySpot = useCallback(
    async (spot: SpotDto) => {
      setSwitching(true);
      setSwitchErr(null);
      try {
        const starIndex = await fetchStarIndex(spot.id);
        onChange({
          mode: 'spot',
          spotId: spot.id,
          label: spotListLabel(spot),
          starIndex,
        });
        setPickerOpen(false);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        setSwitchErr(
          e instanceof ApiRequestError ? e.message : '명소 정보를 불러오지 못했습니다.',
        );
      } finally {
        setSwitching(false);
      }
    },
    [onChange, onSessionInvalidated],
  );

  const applyCustomPick = useCallback(
    async (pick: { lat: number; lng: number; label: string }) => {
      setSwitching(true);
      setSwitchErr(null);
      try {
        const starIndex = await fetchStarIndexAtLocation(pick.lat, pick.lng);
        onChange({
          mode: 'custom',
          spotId: null,
          label: pick.label,
          starIndex,
          customLat: pick.lat,
          customLng: pick.lng,
        });
        setCustomOpen(false);
        setPickerOpen(false);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        setSwitchErr(
          e instanceof ApiRequestError ? e.message : '위치 정보를 불러오지 못했습니다.',
        );
      } finally {
        setSwitching(false);
      }
    },
    [onChange, onSessionInvalidated],
  );

  const openCustom = useCallback(() => {
    setCustomOpen(true);
  }, []);

  const noSpotResults =
    searchQuery.trim().length >= 1 && hasSearched && !searchLoading && searchResults.length === 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.foreground }]}>관측 위치</Text>

      <AppPressable
        onPress={() => !disabled && setPickerOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.selector,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.cardBorder,
            opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="관측 위치 선택"
      >
        <View style={styles.selectorTop}>
          <Feather name="map-pin" size={18} color={theme.primaryGlow} style={styles.selectorIcon} />
          <View style={styles.selectorTextBlock}>
            <Text
              style={[styles.selectorText, { color: theme.foreground }]}
              numberOfLines={2}
            >
              {value.label}
            </Text>
            {value.mode === 'custom' ? (
              <Text style={[styles.selectorSub, { color: theme.mutedForeground }]}>
                직접 입력한 위치
              </Text>
            ) : value.mode === 'spot' ? (
              <Text style={[styles.selectorSub, { color: theme.mutedForeground }]}>
                별보기 명소
              </Text>
            ) : (
              <Text style={[styles.selectorSub, { color: theme.mutedForeground }]}>
                현재 위치
              </Text>
            )}
          </View>
          <LocationScoreBadge
            starIndex={value.starIndex}
            loading={switching && (!pickerOpen || customOpen)}
          />
          <Feather name="chevron-right" size={18} color={theme.mutedForeground} />
        </View>

        {switching && (!pickerOpen || customOpen) ? (
          <View style={[styles.scoreBar, { borderTopColor: theme.borderSubtle }]}>
            <Text style={[styles.scoreBarHint, { color: theme.mutedForeground }]}>
              점수 측정 중이에요
            </Text>
            <Text style={[styles.scoreBarValue, { color: theme.primaryGlow, fontSize: 13 }]}>
              구름·미세먼지·달빛 확인 중
            </Text>
          </View>
        ) : null}

        {!switching && scoreDisplay.measurable ? (
          <View style={[styles.scoreBar, { borderTopColor: theme.borderSubtle }]}>
            <Text style={[styles.scoreBarHint, { color: theme.mutedForeground }]}>
              이 위치 기준 관측 점수
            </Text>
            <Text
              style={[
                styles.scoreBarValue,
                { color: theme.primaryGlow, fontFamily: 'SpaceMono-Regular' },
              ]}
            >
              {scoreDisplay.label}
            </Text>
          </View>
        ) : null}
      </AppPressable>

      {switchErr && !pickerOpen ? (
        <Text style={[styles.err, { color: theme.destructive }]}>{switchErr}</Text>
      ) : null}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !switching && setPickerOpen(false)}
      >
        <AppPressable
          style={styles.modalBackdrop}
          onPress={() => !switching && setPickerOpen(false)}
        >
          <AppPressable
            style={[styles.modalSheet, glassCardStyle(theme)]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              관측 위치 선택
            </Text>

            {switching ? (
              <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: spacing.md }} />
            ) : null}

            {switchErr ? (
              <Text style={[styles.err, { color: theme.destructive }]}>{switchErr}</Text>
            ) : null}

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <AppPressable
                onPress={() => void applyCurrent()}
                disabled={switching}
                style={({ pressed }) => [
                  styles.modalRow,
                  value.mode === 'current' && {
                    backgroundColor: 'rgba(141, 220, 255, 0.08)',
                    borderColor: theme.primaryGlowBorder,
                  },
                ]}
              >
                <View style={styles.rowMain}>
                  <Feather name="navigation" size={16} color={theme.primaryGlow} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: theme.foreground }]}>
                      현재 위치
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                      {coordsReady
                        ? placeLabel?.trim() || 'GPS 기준으로 기록'
                        : '좌표 없음 — 아래에서 명소를 검색하거나 직접 입력하세요'}
                    </Text>
                  </View>
                </View>
                {value.mode === 'current' ? (
                  <Feather name="check" size={18} color={theme.primaryGlow} />
                ) : null}
              </AppPressable>

              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                별보기 명소 검색
              </Text>

              <View
                style={[
                  styles.searchWrap,
                  { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Feather name="search" size={16} color={theme.mutedForeground} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="지역·명소 이름 (예: 강원, 제주)"
                  placeholderTextColor={theme.mutedForeground}
                  editable={!switching}
                  style={[styles.searchInput, { color: theme.foreground }]}
                />
              </View>

              <Text style={[styles.searchHint, { color: theme.mutedForeground }]}>
                검색어를 입력하면 해당 지역·명소가 표시됩니다.
              </Text>

              {searchQuery.trim().length >= 1 && searchLoading ? (
                <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 12 }} />
              ) : null}

              {searchErr ? (
                <Text style={[styles.err, { color: theme.destructive, marginBottom: spacing.sm }]}>
                  {searchErr}
                </Text>
              ) : null}

              {searchResults.map((spot) => {
                const selected = value.mode === 'spot' && value.spotId === spot.id;
                return (
                  <AppPressable
                    key={spot.id}
                    onPress={() => void applySpot(spot)}
                    disabled={switching}
                    style={({ pressed }) => [
                      styles.modalRow,
                      selected && {
                        backgroundColor: 'rgba(141, 220, 255, 0.08)',
                        borderColor: theme.primaryGlowBorder,
                      },
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <Feather name="star" size={16} color={theme.primaryGlow} />
                      <View style={styles.rowText}>
                        <Text
                          style={[styles.rowTitle, { color: theme.foreground }]}
                          numberOfLines={2}
                        >
                          {spotListLabel(spot)}
                        </Text>
                        <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                          {spot.name}
                        </Text>
                      </View>
                    </View>
                    {selected ? (
                      <Feather name="check" size={18} color={theme.primaryGlow} />
                    ) : null}
                  </AppPressable>
                );
              })}

              <View
                style={[
                  styles.directCard,
                  {
                    backgroundColor: 'rgba(141, 220, 255, 0.06)',
                    borderColor: theme.primaryGlowBorder,
                  },
                ]}
              >
                <View style={styles.directCardIcon}>
                  <Feather name="help-circle" size={20} color={theme.primaryGlow} />
                </View>
                <Text style={[styles.directCardTitle, { color: theme.foreground }]}>
                  관측하신 장소가 명소로 등록되어 있지 않나요?
                </Text>
                <Text style={[styles.directCardSub, { color: theme.mutedForeground }]}>
                  {noSpotResults
                    ? `"${searchQuery.trim()}"(으)로 등록된 명소가 없습니다.`
                    : '등록되지 않은 곳도 장소 검색으로 기록할 수 있습니다.'}
                </Text>
                <Text style={[styles.directCardSub, { color: theme.mutedForeground }]}>
                  명소 제보 탭에서 장소를 제보하시면, 검토 후 명소로 등록될 수 있어요.
                </Text>
                <AppPressable
                  onPress={openCustom}
                  disabled={switching}
                  style={({ pressed }) => [
                    styles.directBtn,
                    {
                      backgroundColor: theme.primaryGlow,
                      opacity: switching ? 0.5 : pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Feather name="edit-3" size={16} color={theme.deepNavy} />
                  <Text style={[styles.directBtnText, { color: theme.deepNavy }]}>
                    직접 입력하기
                  </Text>
                </AppPressable>
              </View>

              {value.mode === 'custom' ? (
                <AppPressable
                  onPress={openCustom}
                  disabled={switching}
                  style={({ pressed }) => [
                    styles.modalRow,
                    {
                      backgroundColor: 'rgba(141, 220, 255, 0.08)',
                      borderColor: theme.primaryGlowBorder,
                      marginTop: spacing.sm,
                    },
                  ]}
                >
                  <View style={styles.rowMain}>
                    <Feather name="map-pin" size={16} color={theme.primaryGlow} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme.foreground }]}>
                        {value.label}
                      </Text>
                      <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                        직접 입력한 위치 · 탭하여 변경
                      </Text>
                    </View>
                  </View>
                  <LocationScoreBadge starIndex={value.starIndex} />
                </AppPressable>
              ) : null}
            </ScrollView>
          </AppPressable>
        </AppPressable>
      </Modal>

      <DiaryLocationCustomModal
        visible={customOpen}
        initialQuery={searchQuery.trim()}
        onClose={() => {
          if (!switching) setCustomOpen(false);
        }}
        onConfirm={applyCustomPick}
        onSessionInvalidated={onSessionInvalidated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '500' },
  selector: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: spacing.md,
  },
  selectorTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  selectorIcon: { marginTop: 2 },
  selectorTextBlock: {
    flex: 1,
    gap: 6,
    paddingRight: spacing.xs,
  },
  selectorText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  selectorSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  scoreBarHint: { fontSize: 12 },
  scoreBarValue: { fontSize: 18, fontWeight: '600' },
  err: { fontSize: 12, lineHeight: 17 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalSheet: {
    maxHeight: '82%',
    padding: spacing.lg,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalScroll: { maxHeight: 460 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  searchHint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginBottom: spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  rowSub: { fontSize: 11, lineHeight: 16 },
  directCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  directCardIcon: { marginBottom: spacing.xs },
  directCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  directCardSub: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  directBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    width: '100%',
    marginTop: spacing.xs,
  },
  directBtnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

/**
 * 일기 관측 위치 — 등록 명소 외 장소 검색 (지도 없음)
 */

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiRequestError } from '../../lib/api-client';
import {
  formatPlaceSearchItemLabel,
  formatPlaceSearchItemSubtitle,
} from '../../lib/place-search-label';
import { fetchPlacesSearch, SessionExpiredError } from '../../lib/places-api';
import type { PlaceSearchItem } from '../../lib/places-api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { Button } from '../ui';
import { StarIndexMeasuringPanel } from '../ui/StarIndexMeasuringPanel';

export interface DiaryLocationCustomResult {
  lat: number;
  lng: number;
  label: string;
}

interface DiaryLocationCustomModalProps {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onConfirm: (result: DiaryLocationCustomResult) => Promise<void>;
  onSessionInvalidated: () => Promise<void>;
}

const SEARCH_DEBOUNCE_MS = 360;

export function DiaryLocationCustomModal({
  visible,
  initialQuery = '',
  onClose,
  onConfirm,
  onSessionInvalidated,
}: DiaryLocationCustomModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlaceSearchItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setSearchQuery(initialQuery.trim());
    setResults([]);
    setSearchErr(null);
    setSelected(null);
    setSearchLoading(false);
    setConfirming(false);
  }, [visible, initialQuery]);

  useEffect(() => {
    if (!visible) return;
    const q = searchQuery.trim();
    if (q.length < 1) {
      setResults([]);
      setSearchLoading(false);
      setSearchErr(null);
      return;
    }

    const seq = ++searchSeq.current;
    setSearchLoading(true);
    setSearchErr(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await fetchPlacesSearch(q, 12);
          if (searchSeq.current !== seq) return;
          setResults(rows);
          if (rows.length === 0) {
            setSearchErr('검색 결과가 없습니다. 다른 이름으로 검색해 보세요.');
          }
        } catch (e) {
          if (searchSeq.current !== seq) return;
          if (e instanceof SessionExpiredError) {
            await onSessionInvalidated();
            return;
          }
          setSearchErr(
            e instanceof ApiRequestError ? e.message : '장소 검색에 실패했습니다.',
          );
          setResults([]);
        } finally {
          if (searchSeq.current === seq) setSearchLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, visible, onSessionInvalidated]);

  const confirm = useCallback(() => {
    if (!selected || confirming) return;
    void (async () => {
      setConfirming(true);
      try {
        await onConfirm({
          lat: selected.lat,
          lng: selected.lng,
          label: formatPlaceSearchItemLabel(selected),
        });
      } finally {
        setConfirming(false);
      }
    })();
  }, [confirming, onConfirm, selected]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!confirming) onClose();
      }}
    >
      <View style={[styles.root, { backgroundColor: theme.deepNavy }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.sm, borderBottomColor: theme.border },
          ]}
        >
          <AppPressable
            onPress={onClose}
            hitSlop={12}
            disabled={confirming}
            accessibilityLabel="닫기"
          >
            <Text
              style={[
                styles.headerBtn,
                { color: confirming ? theme.border : theme.mutedForeground },
              ]}
            >
              취소
            </Text>
          </AppPressable>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>장소 직접 입력</Text>
          <View style={styles.headerBtn} />
        </View>

        {confirming ? (
          <View style={styles.measuringOverlay}>
            <StarIndexMeasuringPanel
              compact
              hint="이 위치의 Star-Index를 계산하고 있어요"
            />
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.hintBlock}>
            <Text style={[styles.hint, { color: theme.mutedForeground }]}>
              장소·주소를 정확히 검색한 뒤 목록에서 선택해 주세요.
            </Text>
            <Text style={[styles.hintSub, { color: theme.mutedForeground }]}>
              지역이 나오지 않는다면 근처 지역을 선택해 주세요.
            </Text>
          </View>

          <View
            style={[
              styles.searchWrap,
              { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Feather name="search" size={18} color={theme.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="장소를 입력해 주세요."
              placeholderTextColor={theme.mutedForeground}
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.foreground }]}
            />
          </View>

          {searchLoading ? (
            <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: spacing.md }} />
          ) : null}

          {searchErr ? (
            <Text style={[styles.err, { color: theme.destructive }]}>{searchErr}</Text>
          ) : null}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {results.map((item, idx) => {
              const subtitle = formatPlaceSearchItemSubtitle(item);
              const isSelected =
                selected != null &&
                selected.lat === item.lat &&
                selected.lng === item.lng &&
                selected.name === item.name;
              return (
                <AppPressable
                  key={`${item.lat}-${item.lng}-${idx}`}
                  onPress={() => setSelected(item)}
                  style={({ pressed }) => [
                    styles.resultRow,
                    isSelected && {
                      backgroundColor: 'rgba(141, 220, 255, 0.1)',
                      borderColor: theme.primaryGlowBorder,
                    },
                    {
                      borderColor: theme.cardBorder,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Feather name="map-pin" size={16} color={theme.primaryGlow} />
                  <View style={styles.resultText}>
                    <Text style={[styles.resultTitle, { color: theme.foreground }]} numberOfLines={2}>
                      {formatPlaceSearchItemLabel(item)}
                    </Text>
                    {subtitle ? (
                      <Text
                        style={[styles.resultSub, { color: theme.mutedForeground }]}
                        numberOfLines={2}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Feather name="check-circle" size={20} color={theme.primaryGlow} />
                  ) : null}
                </AppPressable>
              );
            })}
          </ScrollView>
        </View>

        <View
          style={[
            styles.footer,
            glassCardStyle(theme),
            {
              marginHorizontal: spacing.lg,
              marginBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          {selected ? (
            <Text style={[styles.footerLabel, { color: theme.foreground }]} numberOfLines={2}>
              {formatPlaceSearchItemLabel(selected)}
            </Text>
          ) : (
            <Text style={[styles.footerHint, { color: theme.mutedForeground }]}>
              목록에서 장소를 선택해 주세요.
            </Text>
          )}
          <Button
            label={confirming ? '측정 중…' : '이 위치로 선택'}
            fullWidth
            disabled={!selected || confirming}
            loading={confirming}
            onPress={confirm}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  headerBtn: { minWidth: 48, fontSize: 15 },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    position: 'relative',
  },
  measuringOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(5, 10, 24, 0.92)',
  },
  hintBlock: { gap: 6, marginBottom: spacing.md },
  hint: { fontSize: 13, lineHeight: 19 },
  hintSub: { fontSize: 12, lineHeight: 17, opacity: 0.92 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  err: { fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  list: { flex: 1 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  resultText: { flex: 1, gap: 4 },
  resultTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  resultSub: { fontSize: 12, lineHeight: 17 },
  footer: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
  },
  footerLabel: { fontSize: 14, fontWeight: '500', lineHeight: 21 },
  footerHint: { fontSize: 13, lineHeight: 19 },
});

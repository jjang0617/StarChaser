/**
 * MAP 탭 — 명소 검색 오버레이 (GET /spots/search)
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiRequestError, SessionExpiredError } from '../../lib/api-client';
import { fetchSpotsSearch } from '../../lib/spots-api';
import {
  spotNameWithoutRegionPrefix,
  spotRegionSubtitle,
} from '../../lib/spot-display-name';
import type { SpotDto } from '../../lib/types/api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import type { ThemeTokens } from '../../themes/themes';
import { AppAlertModal } from '../ui/AppAlertModal';

const SEARCH_DEBOUNCE_MS = 320;
const TOP_BUTTON_SIZE = 44;
const TOP_BUTTON_GAP = 8;

function hasValidCoords(spot: SpotDto): boolean {
  return Number.isFinite(spot.lat) && Number.isFinite(spot.lng);
}

interface MapSpotSearchOverlayProps {
  theme: ThemeTokens;
  visible: boolean;
  onClose: () => void;
  onPickSpot: (spot: SpotDto) => void;
  onSessionInvalidated: () => Promise<void>;
}

export function MapSpotSearchOverlay({
  theme,
  visible,
  onClose,
  onPickSpot,
  onSessionInvalidated,
}: MapSpotSearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [noCoordsAlert, setNoCoordsAlert] = useState(false);
  const searchSeq = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const topOffset = Math.max(insets.top, 8) + spacing.sm;

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      setError(null);
      return;
    }

    const seq = ++searchSeq.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await fetchSpotsSearch(q, 50);
          if (searchSeq.current !== seq) return;
          setResults(rows);
          setHasSearched(true);
        } catch (e) {
          if (searchSeq.current !== seq) return;
          if (e instanceof SessionExpiredError) {
            await onSessionInvalidated();
            return;
          }
          setError(
            e instanceof ApiRequestError ? e.message : '명소 검색에 실패했습니다.',
          );
          setResults([]);
          setHasSearched(true);
        } finally {
          if (searchSeq.current === seq) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, visible, onSessionInvalidated]);

  if (!visible) return null;

  const trimmed = query.trim();
  const showEmpty =
    trimmed.length >= 1 && hasSearched && !loading && results.length === 0 && !error;

  const handlePick = (spot: SpotDto) => {
    if (!hasValidCoords(spot)) {
      setNoCoordsAlert(true);
      return;
    }
    onPickSpot(spot);
  };

  return (
    <>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="검색 닫기"
      />
      <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
        <View
          style={[
            styles.panel,
            glassCardStyle(theme),
            { marginRight: spacing.lg + TOP_BUTTON_SIZE * 2 + TOP_BUTTON_GAP },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Feather name="search" size={16} color={theme.mutedForeground} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="명소·지역 검색 (예: 황매산, 제주)"
              placeholderTextColor={theme.mutedForeground}
              style={[styles.input, { color: theme.foreground }]}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
              >
                <Feather name="x-circle" size={16} color={theme.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <Text style={[styles.hint, { color: theme.destructive }]}>{error}</Text>
          ) : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primaryGlow} />
              <Text style={[styles.hint, { color: theme.mutedForeground }]}>검색 중…</Text>
            </View>
          ) : null}

          {showEmpty ? (
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>
              검색 결과가 없습니다
            </Text>
          ) : null}

          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const title = spotNameWithoutRegionPrefix(item.name) || item.name;
                const region = spotRegionSubtitle(item.name);
                const missingCoords = !hasValidCoords(item);
                return (
                  <Pressable
                    onPress={() => handlePick(item)}
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        backgroundColor: pressed ? theme.inputBackground : 'transparent',
                        opacity: missingCoords ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Feather name="star" size={14} color={theme.primaryGlow} />
                    <View style={styles.resultText}>
                      <Text
                        style={[styles.resultTitle, { color: theme.foreground }]}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                      <Text
                        style={[styles.resultSub, { color: theme.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {region || item.name}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.mutedForeground} />
                  </Pressable>
                );
              }}
            />
          ) : null}
        </View>
      </View>

      <AppAlertModal
        visible={noCoordsAlert}
        tone="default"
        title="위치 정보 없음"
        message="이 명소에는 좌표 정보가 없어 지도로 이동할 수 없습니다."
        primaryLabel="확인"
        onPrimary={() => setNoCoordsAlert(false)}
        onRequestClose={() => setNoCoordsAlert(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
  },
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: 0,
    zIndex: 20,
  },
  panel: {
    borderRadius: 16,
    padding: spacing.sm,
    gap: spacing.xs,
    maxHeight: 320,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  list: {
    maxHeight: 220,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultSub: {
    fontSize: 11,
  },
});

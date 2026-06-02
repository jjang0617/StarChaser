import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { BottomToast, Button } from '../ui';
import { GlassCard } from '../ui/GlassCard';
import { DiarySegmentTabs, type DiarySectionKey } from './DiarySegmentTabs';
import { DiaryDetailModal } from './DiaryDetailModal';
import { DiaryEntryCard } from './DiaryEntryCard';
import { DiarySectionHeader } from './DiarySectionHeader';
import { DiaryTabHero } from './DiaryTabHero';
import { DiaryWriteModal } from './DiaryWriteModal';
import { IntroDiaryBackdrop } from './IntroDiaryBackdrop';
import { SpotReportSection } from './SpotReportSection';
import { ObservationResultPicker, type ObservationResult } from './ObservationResultPicker';
import {
  ApiRequestError,
  fetchMyObservations,
  SessionExpiredError,
  type ObservationRowDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';

interface RecordsTabScreenProps {
  activeSpotId: string | null;
  observerLat?: number | null;
  observerLng?: number | null;
  useDeviceLocation?: boolean;
  onSessionInvalidated: () => Promise<void>;
  starIndexData: StarIndexResponseDto | null;
  starIndexLoading: boolean;
  canLoadStarIndex: boolean;
  resolveSpotIdForSave: () => string | undefined;
  starIndexFromGps?: boolean;
  starIndexPlaceLabel?: string | null;
}

export function RecordsTabScreen({
  observerLat = null,
  observerLng = null,
  useDeviceLocation = true,
  onSessionInvalidated,
  starIndexData,
  starIndexLoading,
  canLoadStarIndex,
  resolveSpotIdForSave,
  starIndexFromGps = false,
  starIndexPlaceLabel = null,
}: RecordsTabScreenProps) {
  const { theme } = useTheme();
  const [diarySection, setDiarySection] = useState<DiarySectionKey>('write');
  const [list, setList] = useState<ObservationRowDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  const [result, setResult] = useState<ObservationResult>('success');
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ObservationRowDto | null>(null);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const rows = await fetchMyObservations();
      setList(rows.map((row) => ({ ...row, photos: row.photos ?? [] })));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setListErr(e.message);
      } else {
        setListErr('목록을 불러오지 못했습니다.');
      }
    } finally {
      setListLoading(false);
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const onDiarySaved = useCallback(async () => {
    await loadList();
    setDiarySection('browse');
  }, [loadList]);

  return (
    <>
      <View style={styles.root}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <IntroDiaryBackdrop />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
        >
          <DiaryTabHero />

          <DiarySegmentTabs active={diarySection} onChange={setDiarySection} />

          {diarySection === 'write' ? (
            <>
              {!canLoadStarIndex ? (
                <GlassCard glow>
                  <DiarySectionHeader
                    icon="navigation"
                    title="위치가 필요해요"
                    subtitle="위치를 허용하거나 지도에서 명소를 선택해 주세요."
                  />
                </GlassCard>
              ) : (
                <GlassCard glow style={styles.writeCard}>
                  <DiarySectionHeader
                    icon="edit-3"
                    title="오늘의 관측"
                    subtitle="결과를 고른 뒤 밤하늘 일기를 남겨 보세요."
                  />
                  {starIndexLoading && !starIndexData ? (
                    <ActivityIndicator
                      color={theme.primaryGlow}
                      style={{ marginBottom: spacing.sm }}
                    />
                  ) : null}
                  <ObservationResultPicker value={result} onChange={setResult} />
                  <View style={styles.writeCta}>
                    <Button
                      label="오늘의 일기 쓰기"
                      fullWidth
                      disabled={!starIndexData || starIndexLoading}
                      onPress={() => setWriteModalOpen(true)}
                    />
                  </View>
                </GlassCard>
              )}
            </>
          ) : null}

          {diarySection === 'register-spot' ? (
            <SpotReportSection
              observerLat={observerLat}
              observerLng={observerLng}
              useDeviceLocation={useDeviceLocation}
              onSessionInvalidated={onSessionInvalidated}
            />
          ) : null}

          {diarySection === 'browse' ? (
            <View>
              <DiarySectionHeader
                icon="book-open"
                title="내 일기"
                subtitle="지난 관측 기록을 모아 봤어요."
                trailing={
                  list.length > 0 ? (
                    <View
                      style={[
                        styles.countBadge,
                        {
                          backgroundColor: theme.primaryGlowMuted,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.countText, { color: theme.primaryGlow }]}>
                        {list.length}
                      </Text>
                    </View>
                  ) : null
                }
              />

              {listLoading ? (
                <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 24 }} />
              ) : listErr ? (
                <Text style={{ color: theme.destructive }}>{listErr}</Text>
              ) : list.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <View style={styles.emptyInner}>
                    <Feather name="moon" size={32} color={theme.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
                      아직 일기가 없어요
                    </Text>
                    <Text style={[styles.emptyBody, { color: theme.mutedForeground }]}>
                      오늘의 일기를 쓰면 여기에 쌓여요.
                    </Text>
                    <Button
                      label="일기 작성하러 가기"
                      variant="outline"
                      size="sm"
                      onPress={() => setDiarySection('write')}
                    />
                  </View>
                </GlassCard>
              ) : (
                <View style={styles.logList}>
                  {list.map((row) => (
                    <DiaryEntryCard
                      key={row.id}
                      row={row}
                      onPress={() => setDetailRow(row)}
                    />
                  ))}
                </View>
              )}
              {!listLoading ? (
                <View style={styles.refreshRow}>
                  <Button label="새로고침" variant="ghost" size="sm" onPress={() => void loadList()} />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>

      {starIndexData ? (
        <DiaryWriteModal
          visible={writeModalOpen}
          result={result}
          starIndexData={starIndexData}
          initialSpotId={resolveSpotIdForSave()}
          fromGps={starIndexFromGps}
          observerLat={observerLat}
          observerLng={observerLng}
          placeLabel={starIndexPlaceLabel}
          onClose={() => setWriteModalOpen(false)}
          onSaved={() => void onDiarySaved()}
          onSessionInvalidated={onSessionInvalidated}
        />
      ) : null}

      <DiaryDetailModal
        visible={detailRow != null}
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onDeleted={() => {
          void loadList();
          setDeleteToastVisible(true);
        }}
        onSessionInvalidated={onSessionInvalidated}
      />

      <BottomToast
        visible={deleteToastVisible}
        message="삭제되었습니다."
        onHide={() => setDeleteToastVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },
  writeCard: {
    marginBottom: spacing.sm,
  },
  writeCta: {
    marginTop: spacing.md,
  },
  logList: {
    marginTop: spacing.xs,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginTop: 6,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    marginBottom: spacing.md,
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  refreshRow: {
    marginTop: 4,
    alignItems: 'center',
  },
});

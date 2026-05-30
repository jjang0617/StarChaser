/**
 * 일기 상세 모달 — 전체 내용 · 사진 · 삭제 · 불일치 제보
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ApiRequestError,
  deleteObservation,
  fetchObservationReportStatus,
  SessionExpiredError,
  submitObservationMismatchReport,
  type ObservationRowDto,
} from '../../lib/api-client';
import {
  detectObservationMismatch,
  mismatchHint,
  mismatchTypeLabel,
  type ObservationMismatchType,
} from '../../lib/observation-mismatch';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';

const RESULT_META: Record<
  ObservationRowDto['result'],
  { label: string; icon: React.ComponentProps<typeof Feather>['name'] }
> = {
  success: { label: '성공', icon: 'check-circle' },
  partial: { label: '부분 성공', icon: 'minus-circle' },
  fail: { label: '실패', icon: 'x-circle' },
};

function formatDateTimeKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ResultStatCard({ result }: { result: ObservationRowDto['result'] }) {
  const { theme } = useTheme();
  const meta = RESULT_META[result];
  const accent =
    result === 'success'
      ? theme.primaryGlow
      : result === 'partial'
        ? theme.secondary
        : theme.destructive;

  return (
    <View style={styles.statCard}>
      <View style={styles.statLabelRow}>
        <Feather name={meta.icon} size={13} color={accent} />
        <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>관측 결과</Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]}>{meta.label}</Text>
    </View>
  );
}

function StarIndexStatCard({ value }: { value: number }) {
  const { theme } = useTheme();
  const si = getStarIndexScoreDisplay(value);
  const accent = si.measurable ? theme.primaryGlow : theme.destructive;

  return (
    <View style={styles.statCard}>
      <View style={styles.statLabelRow}>
        <Feather name="star" size={13} color={accent} />
        <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>Star-Index</Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]}>{si.label}</Text>
      {si.measurable ? (
        <View style={[styles.gaugeTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <View
            style={[
              styles.gaugeFill,
              { width: `${si.gaugePercent}%`, backgroundColor: accent },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function MismatchReportSection({
  observationId,
  mismatchType,
  onSessionInvalidated,
}: {
  observationId: string;
  mismatchType: ObservationMismatchType;
  onSessionInvalidated: () => Promise<void>;
}) {
  const { theme } = useTheme();
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchObservationReportStatus(observationId);
        if (!cancelled && status.submitted) {
          setReportSubmitted(true);
        }
      } catch {
        /* 제보 상태 조회 실패 시 제보 버튼만 표시 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [observationId]);

  const submitReport = useCallback(async () => {
    setReportBusy(true);
    setReportError(null);
    try {
      await submitObservationMismatchReport({
        observationId,
        mismatchType,
      });
      setReportSubmitted(true);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError && e.status === 409) {
        setReportSubmitted(true);
        return;
      }
      setReportError(
        e instanceof ApiRequestError ? e.message : '제보에 실패했습니다.',
      );
    } finally {
      setReportBusy(false);
    }
  }, [mismatchType, observationId, onSessionInvalidated]);

  return (
    <View style={[styles.reportBox, { borderColor: theme.cardBorder }]}>
      <View style={styles.reportHeader}>
        <Feather name="alert-circle" size={14} color={theme.secondary} />
        <Text style={[styles.reportTag, { color: theme.secondary }]}>
          {mismatchTypeLabel(mismatchType)}
        </Text>
      </View>
      <Text style={[styles.reportHint, { color: theme.mutedForeground }]}>
        {mismatchHint(mismatchType)}
      </Text>
      {reportSubmitted ? (
        <Text style={[styles.reportDone, { color: theme.primaryGlow }]}>
          제보가 접수되었습니다. 검토 후 반영하겠습니다.
        </Text>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label="불일치 제보하기"
            variant="outline"
            size="sm"
            loading={reportBusy}
            disabled={reportBusy}
            onPress={() => void submitReport()}
          />
        </View>
      )}
      {reportError ? (
        <Text style={[styles.err, { color: theme.destructive }]}>{reportError}</Text>
      ) : null}
    </View>
  );
}

function DiaryPhotoGallery({
  photos,
}: {
  photos: ObservationRowDto['photos'];
}) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const photoWidth = Math.min(200, screenWidth - spacing.lg * 2 - spacing.sm);

  if (photos.length === 0) return null;

  return (
    <View style={styles.photoSection}>
      <FlatList
        data={photos}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        decelerationRate="fast"
        snapToInterval={photoWidth + spacing.sm}
        snapToAlignment="start"
        disableIntervalMomentum
        style={styles.photoList}
        contentContainerStyle={styles.photoRow}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.imageUrl }}
            style={[
              styles.photo,
              {
                width: photoWidth,
                borderColor: theme.cardBorder,
              },
            ]}
            resizeMode="cover"
          />
        )}
      />
      {photos.length > 1 ? (
        <Text style={[styles.photoSwipeHint, { color: theme.mutedForeground }]}>
          ← 좌우로 밀어 {photos.length}장 보기
        </Text>
      ) : null}
    </View>
  );
}

interface DiaryDetailModalProps {
  visible: boolean;
  row: ObservationRowDto | null;
  onClose: () => void;
  onDeleted: () => void;
  onSessionInvalidated: () => Promise<void>;
}

export function DiaryDetailModal({
  visible,
  row,
  onClose,
  onDeleted,
  onSessionInvalidated,
}: DiaryDetailModalProps) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = useCallback(() => {
    if (!row) return;
    Alert.alert('일기 삭제', '이 일기를 삭제할까요? 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await deleteObservation(row.id);
              onDeleted();
              onClose();
            } catch (e) {
              if (e instanceof SessionExpiredError) {
                await onSessionInvalidated();
                return;
              }
              setError(
                e instanceof ApiRequestError ? e.message : '삭제에 실패했습니다.',
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }, [onClose, onDeleted, onSessionInvalidated, row]);

  if (!row) return null;

  const mismatchType = detectObservationMismatch(row.starIndexVal, row.result);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: theme.deepNavy, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={22} color={theme.mutedForeground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.foreground }]} numberOfLines={1}>
              {row.title?.trim() || '일기'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView
            style={[styles.scroll, { backgroundColor: theme.deepNavy }]}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.date, { color: theme.mutedForeground }]}>
              {formatDateTimeKst(row.observedAt)}
            </Text>

            <View style={styles.statsRow}>
              <ResultStatCard result={row.result} />
              <StarIndexStatCard value={row.starIndexVal} />
            </View>

            {mismatchType ? (
              <MismatchReportSection
                observationId={row.id}
                mismatchType={mismatchType}
                onSessionInvalidated={onSessionInvalidated}
              />
            ) : null}

            {row.photos.length > 0 ? <DiaryPhotoGallery photos={row.photos} /> : null}

            <Text style={[styles.content, { color: theme.foreground }]}>
              {(row.content ?? '').trim() || '내용 없음'}
            </Text>

            {error ? (
              <Text style={[styles.err, { color: theme.destructive }]}>{error}</Text>
            ) : null}

            {busy ? (
              <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 8 }} />
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label="삭제"
              variant="destructive"
              fullWidth
              disabled={busy}
              onPress={confirmDelete}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: spacing.xl,
    zIndex: 1,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  scroll: { maxHeight: 520 },
  scrollInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  date: { fontSize: 12, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statCard: {
    flex: 1,
    gap: 4,
    paddingVertical: 2,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statCaption: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  gaugeTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2,
  },
  reportBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  reportHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  reportDone: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  photoSection: {
    marginHorizontal: -spacing.lg,
  },
  photoList: {
    height: 140,
  },
  photoRow: {
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.lg + spacing.sm,
  },
  photo: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoSwipeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.lg,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
  },
  err: { fontSize: 12 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});

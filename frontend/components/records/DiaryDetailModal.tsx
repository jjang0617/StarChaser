/**
 * 일기 상세 모달 — 전체 내용 · 사진 · 삭제 · 불일치 제보
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { DiaryImagePreviewModal } from './DiaryImagePreviewModal';
import {
  ApiRequestError,
  deleteObservation,
  fetchObservationReportStatus,
  SessionExpiredError,
  submitObservationMismatchReport,
  type ObservationRowDto,
} from '../../lib/api-client';
import {
  FELT_SCORE_MISMATCH_PROMPT,
  OBSERVATION_MISMATCH_TYPE_FELT,
} from '../../lib/observation-mismatch';
import { formatObservationPlaceLabel } from '../../lib/observation-place-label';
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
        <Text style={[styles.statCaption, { color: theme.mutedForeground }]}>
          느낀 점수
        </Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]}>{si.label}</Text>
      <View style={[styles.gaugeTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <View
          style={[
            styles.gaugeFill,
            { width: `${si.gaugePercent}%`, backgroundColor: accent },
          ]}
        />
      </View>
    </View>
  );
}

function MismatchReportSection({
  observationId,
  onSessionInvalidated,
}: {
  observationId: string;
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
        mismatchType: OBSERVATION_MISMATCH_TYPE_FELT,
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
  }, [observationId, onSessionInvalidated]);

  return (
    <View style={styles.reportSection}>
      <View style={[styles.reportSectionDivider, { backgroundColor: theme.border }]} />
      <View
        style={[
          styles.reportCard,
          {
            backgroundColor: theme.primaryGlowMuted,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.reportTipRow}>
          <Feather name="info" size={14} color={theme.primaryGlow} />
          <Text style={[styles.reportTipText, { color: theme.primaryGlow }]}>
            {FELT_SCORE_MISMATCH_PROMPT}
          </Text>
        </View>

        <View style={[styles.reportInnerDivider, { backgroundColor: theme.border }]} />

        {reportSubmitted ? (
          <Text style={[styles.reportDone, { color: theme.primaryGlow }]}>
            제보가 접수되었습니다. 검토 후 반영하겠습니다.
          </Text>
        ) : (
          <View style={styles.reportAction}>
            <Button
              label="불일치 제보하기"
              variant="outline"
              size="sm"
              fullWidth
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
    </View>
  );
}

function DiaryPhotoGallery({
  photos,
  onPhotoPress,
}: {
  photos: ObservationRowDto['photos'];
  onPhotoPress: (index: number) => void;
}) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const photoWidth = Math.min(200, screenWidth - spacing.lg * 2 - spacing.sm);

  if (photos.length === 0) return null;

  return (
    <View style={styles.photoSection}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={photoWidth + spacing.sm}
        snapToAlignment="start"
        disableIntervalMomentum
        style={styles.photoList}
        contentContainerStyle={styles.photoRow}
        keyboardShouldPersistTaps="handled"
      >
        {photos.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <View style={{ width: spacing.sm }} /> : null}
            <Pressable
              onPress={() => onPhotoPress(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`일기 사진 ${index + 1}장 크게 보기`}
              style={({ pressed }) => [
                styles.photoFrame,
                {
                  width: photoWidth,
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.inputBackground,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.photoImage}
                resizeMode="contain"
              />
            </Pressable>
          </React.Fragment>
        ))}
      </ScrollView>
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setDeleteConfirmOpen(false);
      setError(null);
      setPreviewIndex(null);
    }
  }, [visible]);

  const performDelete = useCallback(async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await deleteObservation(row.id);
      setDeleteConfirmOpen(false);
      onClose();
      onDeleted();
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setDeleteConfirmOpen(false);
      setError(
        e instanceof ApiRequestError ? e.message : '삭제에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [onClose, onDeleted, onSessionInvalidated, row]);

  if (!row) return null;

  const place = formatObservationPlaceLabel(row.placeLabel);

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

            {place ? (
              <View style={styles.placeRow}>
                <Feather name="map-pin" size={14} color={theme.primaryGlow} />
                <Text style={[styles.placeText, { color: theme.foreground }]}>{place}</Text>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <ResultStatCard result={row.result} />
              <StarIndexStatCard value={row.starIndexVal} />
            </View>

            {row.photos.length > 0 ? (
              <DiaryPhotoGallery
                photos={row.photos}
                onPhotoPress={(index) => setPreviewIndex(index)}
              />
            ) : null}

            <Text style={[styles.content, { color: theme.foreground }]}>
              {(row.content ?? '').trim() || '내용 없음'}
            </Text>

            <MismatchReportSection
              observationId={row.id}
              onSessionInvalidated={onSessionInvalidated}
            />

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
              onPress={() => setDeleteConfirmOpen(true)}
            />
          </View>

          {deleteConfirmOpen ? (
            <View style={styles.confirmOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => !busy && setDeleteConfirmOpen(false)}
                accessibilityLabel="닫기"
              />
              <View
                style={[
                  styles.confirmCard,
                  {
                    backgroundColor: theme.deepNavy,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.confirmIconWrap,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderColor: 'rgba(239, 68, 68, 0.35)',
                    },
                  ]}
                >
                  <Feather name="trash-2" size={22} color={theme.destructive} />
                </View>
                <Text style={[styles.confirmTitle, { color: theme.foreground }]}>
                  일기를 삭제할까요?
                </Text>
                <Text style={[styles.confirmBody, { color: theme.mutedForeground }]}>
                  삭제하면 되돌릴 수 없어요.
                </Text>
                <View style={styles.confirmActions}>
                  <View style={styles.confirmBtn}>
                    <Button
                      label="취소"
                      variant="outline"
                      fullWidth
                      disabled={busy}
                      onPress={() => setDeleteConfirmOpen(false)}
                    />
                  </View>
                  <View style={styles.confirmBtn}>
                    <Button
                      label="삭제"
                      variant="red"
                      fullWidth
                      loading={busy}
                      disabled={busy}
                      onPress={() => void performDelete()}
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          <DiaryImagePreviewModal
            visible={previewIndex != null}
            photos={row.photos}
            initialIndex={previewIndex ?? 0}
            onClose={() => setPreviewIndex(null)}
          />
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
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  placeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
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
  reportSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  reportSectionDivider: {
    height: 1,
    width: '100%',
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reportTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportTipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  reportInnerDivider: {
    height: 1,
    width: '100%',
  },
  reportAction: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportDone: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  photoFrame: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
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
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 11,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
  confirmBtn: {
    flex: 1,
  },
});

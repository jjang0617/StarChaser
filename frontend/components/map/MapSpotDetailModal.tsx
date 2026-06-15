import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import {
  ApiRequestError,
  fetchCorrectionAggregate,
  SessionExpiredError,
  submitStarIndexCorrection,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { useAuth } from '../../contexts/auth-context';
import { isSpotBookmarked, toggleSpotBookmark } from '../../lib/spot-activity-storage';
import { starIndexResponseToCardModel } from '../../lib/star-index-display';
import { Button, Card, SpotCard, StarIndexCard, StatefulCard, type StatefulCardError } from '../ui';
import { CorrectionScoreInput } from './CorrectionScoreInput';

export interface MapSpotDetailModalProps {
  visible: boolean;
  onClose: () => void;
  spotId: string | null;
  loading: boolean;
  error: StatefulCardError | null;
  data: StarIndexResponseDto | null;
  onRetry: () => void;
  onSessionInvalidated: () => Promise<void>;
  starIndexErrorFromApi: (e: ApiRequestError) => StatefulCardError;
  onBookmarkChange?: () => void;
}

function initialReportScore(data: StarIndexResponseDto | null): number {
  if (data && Number.isFinite(data.score)) {
    return Math.min(100, Math.max(0, Math.round(data.score)));
  }
  return 70;
}

/**
 * 지도 마커 탭 시 — Star-Index·명소·보정 제보
 */
export function MapSpotDetailModal({
  visible,
  onClose,
  spotId,
  loading,
  error,
  data,
  onRetry,
  onSessionInvalidated,
  starIndexErrorFromApi,
  onBookmarkChange,
}: MapSpotDetailModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const starProps = data ? starIndexResponseToCardModel(data) : null;

  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const [submissionCount, setSubmissionCount] = useState(0);
  const [reportedScore, setReportedScore] = useState(70);
  const [corrBusy, setCorrBusy] = useState(false);
  const [corrMsg, setCorrMsg] = useState<string | null>(null);

  const loadSubmissionCount = useCallback(async (id: string) => {
    try {
      const a = await fetchCorrectionAggregate(id);
      setSubmissionCount(a.submissionCount);
    } catch {
      setSubmissionCount(0);
    }
  }, []);

  useEffect(() => {
    if (!visible || !spotId) {
      setSubmissionCount(0);
      setCorrMsg(null);
      return;
    }
    void loadSubmissionCount(spotId);
  }, [visible, spotId, loadSubmissionCount]);

  useEffect(() => {
    if (!visible) return;
    setReportedScore(initialReportScore(data));
  }, [visible, data?.score, spotId]);

  useEffect(() => {
    if (!visible || !spotId || !user?.id) {
      setBookmarked(false);
      return;
    }
    let cancelled = false;
    void isSpotBookmarked(user.id, spotId).then((v) => {
      if (!cancelled) setBookmarked(v);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, spotId, user?.id]);

  const handleToggleBookmark = useCallback(() => {
    if (!user?.id || !spotId || bookmarkBusy) return;
    setBookmarkBusy(true);
    void toggleSpotBookmark(user.id, spotId)
      .then((saved) => {
        setBookmarked(saved);
        onBookmarkChange?.();
      })
      .finally(() => setBookmarkBusy(false));
  }, [bookmarkBusy, onBookmarkChange, spotId, user?.id]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>명소 상세</Text>
          <View style={styles.headerActions}>
            {spotId && user?.id ? (
              <Pressable
                onPress={() => void handleToggleBookmark()}
                disabled={bookmarkBusy}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? '저장 해제' : '명소 저장'}
              >
                <Text
                  style={{
                    color: bookmarked ? theme.primaryGlow : theme.mutedForeground,
                    fontSize: 20,
                    fontWeight: '600',
                  }}
                >
                  {bookmarked ? '★' : '☆'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: theme.primaryGlow, fontSize: 15, fontWeight: '600' }}>
                닫기
              </Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!spotId ? (
            <Text style={{ color: theme.mutedForeground }}>명소가 선택되지 않았습니다.</Text>
          ) : (
            <>
              <StatefulCard
                title="Star-Index"
                description={data?.name}
                loading={loading}
                error={error}
                onRetry={onRetry}
                retryLabel="새로고침"
              >
                {starProps ? (
                  <StarIndexCard
                    bare
                    score={starProps.score}
                    sunAltLabel={starProps.sunAltLabel}
                    lightPollutionLabel={starProps.lightPollutionLabel}
                    cloudLabel={starProps.cloudLabel}
                    moonAltLabel={starProps.moonAltLabel}
                    humidityLabel={starProps.humidityLabel}
                    pm25Level={starProps.pm25Level}
                  />
                ) : null}
              </StatefulCard>

              <StatefulCard title="명소" loading={loading} error={error} onRetry={onRetry}>
                {data ? (
                  <SpotCard
                    bare
                    showIndex={false}
                    name={data.name}
                    region={`${data.lat.toFixed(4)} · ${data.lng.toFixed(4)}`}
                    elevation={data.elevationM}
                    bortleClass={data.bortleClass}
                    hasParking={false}
                    hasToilet={false}
                  />
                ) : null}
              </StatefulCard>

              <Card
                title="Star-Index 보정 제보"
                description="점수가 불안정할 경우, 현장에서 느낀 Star-Index 점수를 제보해 주세요."
              >
                <View style={styles.corrStat}>
                  <Text style={[styles.corrStatLabel, { color: theme.mutedForeground }]}>
                    제보
                  </Text>
                  <Text
                    style={[
                      styles.corrStatValue,
                      { color: theme.foreground, fontFamily: 'SpaceMono-Regular' },
                    ]}
                  >
                    {submissionCount}건
                  </Text>
                </View>

                <CorrectionScoreInput
                  value={reportedScore}
                  onChange={setReportedScore}
                  disabled={corrBusy}
                />

                <Button
                  label="제보 보내기"
                  fullWidth
                  loading={corrBusy}
                  disabled={corrBusy}
                  onPress={() => {
                    if (!spotId) return;
                    void (async () => {
                      setCorrBusy(true);
                      setCorrMsg(null);
                      try {
                        await submitStarIndexCorrection({
                          spotId,
                          perceivedQuality: reportedScore,
                        });
                        setCorrMsg('제보를 보냈습니다. 감사합니다.');
                        await loadSubmissionCount(spotId);
                        onRetry();
                      } catch (e) {
                        if (e instanceof SessionExpiredError) {
                          await onSessionInvalidated();
                          return;
                        }
                        if (e instanceof ApiRequestError) {
                          setCorrMsg(starIndexErrorFromApi(e).lines.join(' '));
                        } else {
                          setCorrMsg('제보에 실패했습니다.');
                        }
                      } finally {
                        setCorrBusy(false);
                      }
                    })();
                  }}
                  style={{ marginTop: 12 }}
                />
                {corrMsg ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    {corrMsg}
                  </Text>
                ) : null}
              </Card>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, paddingRight: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, gap: 12, paddingBottom: 40 },
  corrStat: { gap: 4, marginBottom: 4 },
  corrStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  corrStatValue: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
});

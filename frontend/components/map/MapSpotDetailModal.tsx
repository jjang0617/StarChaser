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
  type CorrectionAggregateDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { useAuth } from '../../contexts/auth-context';
import { isSpotBookmarked, toggleSpotBookmark } from '../../lib/spot-activity-storage';
import { starIndexResponseToCardModel } from '../../lib/star-index-display';
import { Button, Card, SpotCard, StarIndexCard, StatefulCard, type StatefulCardError } from '../ui';

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

/**
 * 지도 마커 탭 시 — 기존 Home에 있던 Star-Index·명소·보정 제보
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

  const [corrAgg, setCorrAgg] = useState<CorrectionAggregateDto | null>(null);
  const [perceivedQuality, setPerceivedQuality] = useState(75);
  const [corrBusy, setCorrBusy] = useState(false);
  const [corrMsg, setCorrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !spotId) {
      setCorrAgg(null);
      setCorrMsg(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const a = await fetchCorrectionAggregate(spotId);
        if (!cancelled) setCorrAgg(a);
      } catch {
        if (!cancelled) setCorrAgg(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, spotId]);

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
                    cloudLabel={starProps.cloudLabel}
                    pm25Level={starProps.pm25Level}
                    moonAltitude={starProps.moonAltitude}
                    moonAltitudeKnown={starProps.moonAltitudeKnown}
                  />
                ) : null}
              </StatefulCard>

              <StatefulCard title="명소" loading={loading} error={error} onRetry={onRetry}>
                {data ? (
                  <SpotCard
                    bare
                    name={data.name}
                    region={`${data.lat.toFixed(4)} · ${data.lng.toFixed(4)}`}
                    elevation={data.elevationM}
                    bortleClass={data.bortleClass}
                    starIndex={data.score}
                    hasParking={false}
                    hasToilet={false}
                  />
                ) : null}
              </StatefulCard>

              <Card
                title="Star-Index 보정 제보"
                description="현장 가시도(0~100) — correction_score 집계"
              >
                {corrAgg ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    제보 {corrAgg.submissionCount}건 · 집계 약 {corrAgg.aggregatedCorrectionScore}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginVertical: 8,
                  }}
                >
                  <Button
                    label="−"
                    variant="outline"
                    size="sm"
                    onPress={() => setPerceivedQuality((v) => Math.max(0, v - 5))}
                  />
                  <Text
                    style={{
                      color: theme.foreground,
                      minWidth: 40,
                      textAlign: 'center',
                      fontFamily: 'SpaceMono-Regular',
                    }}
                  >
                    {perceivedQuality}
                  </Text>
                  <Button
                    label="+"
                    variant="outline"
                    size="sm"
                    onPress={() => setPerceivedQuality((v) => Math.min(100, v + 5))}
                  />
                </View>
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
                          perceivedQuality,
                        });
                        setCorrMsg('반영되었습니다. Star-Index를 갱신합니다.');
                        onRetry();
                        const a = await fetchCorrectionAggregate(spotId);
                        setCorrAgg(a);
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
});

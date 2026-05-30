import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { screenHeaderText, screenSubheaderText, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';
import { DiarySegmentTabs, type DiarySectionKey } from './DiarySegmentTabs';
import { DiaryDetailModal } from './DiaryDetailModal';
import { DiaryEntryCard } from './DiaryEntryCard';
import { DiaryWriteModal } from './DiaryWriteModal';
import { SpotReportSection } from './SpotReportSection';
import { ObservationResultPicker, type ObservationResult } from './ObservationResultPicker';
import {
  ApiRequestError,
  fetchMyObservations,
  fetchStarIndex,
  fetchStarIndexAtLocation,
  SessionExpiredError,
  type ObservationRowDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import {
  formatStarIndexStaleHint,
  starIndexLoadErrorMessage,
} from '../../lib/star-index-stale';

interface RecordsTabScreenProps {
  /** 홈·지도와 동일한 기준 명소 UUID (없으면 기록 불가 안내) */
  activeSpotId: string | null;
  /** 있으면 Star-Index는 이 좌표 격자를 우선 (내 위치 점수) */
  observerLat?: number | null;
  observerLng?: number | null;
  /** App에서 위치 기능을 켠 경우에만 기기 GPS 사용 */
  useDeviceLocation?: boolean;
  onSessionInvalidated: () => Promise<void>;
}

export function RecordsTabScreen({
  activeSpotId,
  observerLat = null,
  observerLng = null,
  useDeviceLocation = true,
  onSessionInvalidated,
}: RecordsTabScreenProps) {
  const { theme } = useTheme();
  const [diarySection, setDiarySection] = useState<DiarySectionKey>('write');
  const [list, setList] = useState<ObservationRowDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  const [siData, setSiData] = useState<StarIndexResponseDto | null>(null);
  const [siLoading, setSiLoading] = useState(false);
  const [siErr, setSiErr] = useState<string | null>(null);
  /** GPS 기준 역지오코딩 — 영천 등 “가까운 명소” 이름 대신 실제 동네 표시 */
  const [siPlaceLabel, setSiPlaceLabel] = useState<string | null>(null);
  /** true면 저장 시 spotId 없이 좌표 스냅샷만 (잘못된 명소 연결 방지) */
  const [siFromGps, setSiFromGps] = useState(false);

  const [result, setResult] = useState<ObservationResult>('success');
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ObservationRowDto | null>(null);

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

  const loadSi = useCallback(async () => {
    let lat: number | undefined;
    let lng: number | undefined;

    if (useDeviceLocation && Platform.OS !== 'web') {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        /* 아래에서 observer 좌표 폴백 */
      }
    }

    if (
      (lat == null ||
        lng == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)) &&
      observerLat != null &&
      observerLng != null
    ) {
      lat = observerLat;
      lng = observerLng;
    }

    const hasCoords =
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    if (!hasCoords && !activeSpotId) {
      setSiData(null);
      setSiErr(null);
      setSiPlaceLabel(null);
      setSiFromGps(false);
      return;
    }

    setSiLoading(true);
    setSiErr(null);

    try {
      if (hasCoords) {
        const d = await fetchStarIndexAtLocation(lat!, lng!);
        setSiData(d);
        setSiFromGps(true);
        try {
          if (Platform.OS !== 'web') {
            const geo = await Location.reverseGeocodeAsync({
              latitude: lat!,
              longitude: lng!,
            });
            const a = geo[0];
            if (a) {
              const parts = [
                a.region,
                a.city || a.subregion,
                a.district,
                a.street,
                a.name,
              ].filter((x): x is string => Boolean(x && String(x).trim()));
              const uniq: string[] = [];
              for (const p of parts) {
                if (!uniq.includes(p)) uniq.push(p);
              }
              setSiPlaceLabel(
                uniq.slice(0, 5).join(' ') || `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`,
              );
            } else {
              setSiPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
            }
          } else {
            setSiPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
          }
        } catch {
          setSiPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
        }
        return;
      }

      setSiFromGps(false);
      setSiPlaceLabel(null);
      const d = await fetchStarIndex(activeSpotId!);
      setSiData(d);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setSiErr(starIndexLoadErrorMessage(e));
      } else {
        setSiErr('Star-Index를 불러오지 못했습니다.');
      }
      setSiData(null);
      setSiPlaceLabel(null);
      setSiFromGps(false);
    } finally {
      setSiLoading(false);
    }
  }, [activeSpotId, observerLat, observerLng, useDeviceLocation, onSessionInvalidated]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadSi();
  }, [loadSi]);

  const resolveSpotIdForSave = useCallback((): string | undefined => {
    if (!siData) return undefined;
    if (siFromGps) return undefined;
    if (siData.spotId && siData.spotId.length > 0) return siData.spotId;
    return activeSpotId ?? undefined;
  }, [activeSpotId, siData, siFromGps]);

  const onDiarySaved = useCallback(async () => {
    await loadList();
    setDiarySection('browse');
  }, [loadList]);

  const hasObserverGps =
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng);
  /** 네이티브는 앱에서 GPS 조회 시도 · 웹은 좌표 또는 기본 명소 필요 */
  const canLoadStarIndex =
    Platform.OS !== 'web' || hasObserverGps || Boolean(activeSpotId);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, screenHeaderText(theme.foreground)]}>관측 일기</Text>
        <Text style={[styles.sub, screenSubheaderText(theme.mutedForeground)]}>
          오늘의 밤하늘을 기록하고, Star-Index와 함께 남겨 보세요.
        </Text>

        <DiarySegmentTabs active={diarySection} onChange={setDiarySection} />

        {diarySection === 'write' ? (
          <>
            {!canLoadStarIndex ? (
              <Card title="위치·명소 필요" description="위치 권한을 허용하거나 지도에서 명소를 고르세요">
                <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
                  GPS가 켜지면 현재 위치 격자로 Star-Index를 불러옵니다. 없으면 EXPO_PUBLIC_DEFAULT_SPOT_ID
                  또는 지도 마커로 명소를 정할 수 있어요.
                </Text>
              </Card>
            ) : (
              <Card
                title="현재 Star-Index"
                description={
                  siPlaceLabel
                    ? `${siPlaceLabel} 기준`
                    : siData?.name ?? 'GPS·격자 기준으로 불러옵니다'
                }
              >
                {siLoading ? (
                  <ActivityIndicator color={theme.primaryGlow} />
                ) : siErr ? (
                  <Text style={{ color: theme.destructive }}>{siErr}</Text>
                ) : siData ? (
                  <View>
                    {(() => {
                      const si = getStarIndexScoreDisplay(siData.score);
                      return (
                        <Text
                          style={{
                            color: si.measurable ? theme.primaryGlow : theme.destructive,
                            fontSize: si.measurable ? 28 : 20,
                            fontWeight: '300',
                          }}
                        >
                          {si.label}
                        </Text>
                      );
                    })()}
                    <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 6 }}>
                      {(siPlaceLabel ?? siData.name) +
                        ` · 구름 ${siData.weatherSnapshot.cloud_score}`}
                    </Text>
                    {siData.isStale ? (
                      <Text
                        style={{
                          color: theme.primaryGlow,
                          fontSize: 11,
                          marginTop: 8,
                          lineHeight: 16,
                        }}
                      >
                        {formatStarIndexStaleHint(siData.cachedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={{ marginTop: 8 }}>
                  <Button
                    label="다시 불러오기"
                    variant="outline"
                    size="sm"
                    onPress={() => void loadSi()}
                    disabled={siLoading}
                  />
                </View>
              </Card>
            )}

            <Card
              title="일기 작성"
              description={
                siData?.isStale
                  ? '참고 점수·스냅샷과 함께 일기를 남깁니다'
                  : '오늘의 관측 결과를 선택하고 일기를 작성하세요'
              }
            >
              <ObservationResultPicker value={result} onChange={setResult} />
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label="오늘의 일기 쓰기"
                  fullWidth
                  disabled={!siData}
                  onPress={() => setWriteModalOpen(true)}
                />
              </View>
            </Card>
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
          <Card title="내 일기" description={listLoading ? '불러오는 중…' : `${list.length}건`}>
            {listLoading ? (
              <ActivityIndicator color={theme.primaryGlow} />
            ) : listErr ? (
              <Text style={{ color: theme.destructive }}>{listErr}</Text>
            ) : list.length === 0 ? (
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
                아직 작성한 일기가 없습니다. DIARY 작성에서 첫 일기를 남겨 보세요.
              </Text>
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
              <View style={{ marginTop: 8 }}>
                <Button label="목록 새로고침" variant="ghost" size="sm" onPress={() => void loadList()} />
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {siData ? (
        <DiaryWriteModal
          visible={writeModalOpen}
          result={result}
          starIndexData={siData}
          spotId={resolveSpotIdForSave()}
          onClose={() => setWriteModalOpen(false)}
          onSaved={() => void onDiarySaved()}
          onSessionInvalidated={onSessionInvalidated}
        />
      ) : null}

      <DiaryDetailModal
        visible={detailRow != null}
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onDeleted={() => void loadList()}
        onSessionInvalidated={onSessionInvalidated}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { padding: spacing.lg, paddingBottom: 32 },
  title: { marginBottom: 4 },
  sub: { marginBottom: spacing.lg },
  logList: {
    marginTop: spacing.xs,
  },
});

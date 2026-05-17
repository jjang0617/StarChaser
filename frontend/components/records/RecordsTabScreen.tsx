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
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';
import {
  ApiRequestError,
  createObservation,
  fetchMyObservations,
  fetchStarIndex,
  fetchStarIndexAtLocation,
  SessionExpiredError,
  type ObservationRowDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';

const RESULT_LABEL_KO: Record<'success' | 'partial' | 'fail', string> = {
  success: '성공',
  partial: '부분',
  fail: '실패',
};

interface RecordsTabScreenProps {
  /** 홈·지도와 동일한 기준 명소 UUID (없으면 기록 불가 안내) */
  activeSpotId: string | null;
  /** 있으면 Star-Index는 이 좌표 격자를 우선 (내 위치 점수) */
  observerLat?: number | null;
  observerLng?: number | null;
  onSessionInvalidated: () => Promise<void>;
}

export function RecordsTabScreen({
  activeSpotId,
  observerLat = null,
  observerLng = null,
  onSessionInvalidated,
}: RecordsTabScreenProps) {
  const { theme } = useTheme();
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

  const [result, setResult] = useState<'success' | 'partial' | 'fail'>('success');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const rows = await fetchMyObservations();
      setList(rows);
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

    if (Platform.OS !== 'web') {
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
        const base = e.message;
        setSiErr(
          e.status === 503
            ? `${base} (캐시 미준비 시 Swagger → POST /cron/run-once 후 다시 시도)`
            : base,
        );
      } else {
        setSiErr('Star-Index를 불러오지 못했습니다.');
      }
      setSiData(null);
      setSiPlaceLabel(null);
      setSiFromGps(false);
    } finally {
      setSiLoading(false);
    }
  }, [activeSpotId, observerLat, observerLng, onSessionInvalidated]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadSi();
  }, [loadSi]);

  const onSave = async () => {
    if (!siData) return;
    setSaveBusy(true);
    setSaveMsg(null);
    try {
      const spotForRow = siFromGps
        ? undefined
        : siData.spotId && siData.spotId.length > 0
          ? siData.spotId
          : activeSpotId ?? undefined;
      await createObservation({
        spotId: spotForRow,
        starIndexVal: siData.score,
        weatherSnapshot: siData.weatherSnapshot as unknown as Record<
          string,
          unknown
        >,
        result,
      });
      setSaveMsg('저장했습니다.');
      await loadList();
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setSaveMsg(e.message);
      } else {
        setSaveMsg('저장에 실패했습니다.');
      }
    } finally {
      setSaveBusy(false);
    }
  };

  const hasObserverGps =
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng);
  /** 네이티브는 앱에서 GPS 조회 시도 · 웹은 좌표 또는 기본 명소 필요 */
  const canLoadStarIndex =
    Platform.OS !== 'web' || hasObserverGps || Boolean(activeSpotId);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.inner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.foreground }]}>관측 기록</Text>
      <Text style={[styles.sub, { color: theme.mutedForeground }]}>
        Star-Index 응답의 weather_snapshot으로 저장합니다. 먼저 아래에서 지수를
        불러오세요.
      </Text>

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
            <ActivityIndicator color={theme.starGold} />
          ) : siErr ? (
            <Text style={{ color: theme.destructive }}>{siErr}</Text>
          ) : siData ? (
            <View>
              {(() => {
                const si = getStarIndexScoreDisplay(siData.score);
                return (
                  <Text
                    style={{
                      color: si.measurable ? theme.foreground : theme.destructive,
                      fontSize: si.measurable ? 28 : 20,
                      fontWeight: '700',
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

      <Card title="새 기록" description="결과 선택 후 저장">
        <View style={styles.row}>
          {(
            [
              ['success', '성공'],
              ['partial', '부분'],
              ['fail', '실패'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              label={label}
              variant={result === key ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setResult(key)}
            />
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          <Button
            label="이 스냅샷으로 저장"
            fullWidth
            loading={saveBusy}
            disabled={!siData || saveBusy}
            onPress={() => void onSave()}
          />
        </View>
        {saveMsg ? (
          <Text style={{ color: theme.mutedForeground, marginTop: 8, fontSize: 12 }}>
            {saveMsg}
          </Text>
        ) : null}
      </Card>

      <Card
        title="명소가 목록에 없나요?"
        description="추후 GPS 또는 지역 선택으로 새 명소를 제안·등록할 수 있게 준비 중입니다."
      >
        <Text style={{ color: theme.mutedForeground, fontSize: 13, lineHeight: 19 }}>
          DB에 없는 관측지도 커뮤니티와 함께 채워 나갈 예정이에요.
        </Text>
      </Card>

      <Card title="내 기록" description={listLoading ? '불러오는 중…' : `${list.length}건`}>
        {listLoading ? (
          <ActivityIndicator color={theme.starGold} />
        ) : listErr ? (
          <Text style={{ color: theme.destructive }}>{listErr}</Text>
        ) : list.length === 0 ? (
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>기록이 없습니다.</Text>
        ) : (
          list.map((row) => (
            <View
              key={row.id}
              style={[
                styles.listRow,
                { borderColor: theme.borderSubtle },
              ]}
            >
              <Text style={{ color: theme.foreground, fontWeight: '600' }}>
                {RESULT_LABEL_KO[row.result]} · Star-Index {row.starIndexVal}
              </Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 4 }}>
                {new Date(row.observedAt).toLocaleString('ko-KR', {
                  timeZone: 'Asia/Seoul',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {row.spotId ? ` · spot …${row.spotId.slice(-8)}` : ''}
              </Text>
            </View>
          ))
        )}
        {!listLoading ? (
          <View style={{ marginTop: 8 }}>
            <Button label="목록 새로고침" variant="ghost" size="sm" onPress={() => void loadList()} />
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 6 },
  sub: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
});

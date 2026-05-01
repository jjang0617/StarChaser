import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  SessionExpiredError,
  type ObservationRowDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';

interface RecordsTabScreenProps {
  /** 홈·지도와 동일한 기준 명소 UUID (없으면 기록 불가 안내) */
  activeSpotId: string | null;
  onSessionInvalidated: () => Promise<void>;
}

export function RecordsTabScreen({
  activeSpotId,
  onSessionInvalidated,
}: RecordsTabScreenProps) {
  const { theme } = useTheme();
  const [list, setList] = useState<ObservationRowDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  const [siData, setSiData] = useState<StarIndexResponseDto | null>(null);
  const [siLoading, setSiLoading] = useState(false);
  const [siErr, setSiErr] = useState<string | null>(null);

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
    if (!activeSpotId) {
      setSiData(null);
      setSiErr(null);
      return;
    }
    setSiLoading(true);
    setSiErr(null);
    try {
      const d = await fetchStarIndex(activeSpotId);
      setSiData(d);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setSiErr(e.message);
      } else {
        setSiErr('Star-Index를 불러오지 못했습니다.');
      }
      setSiData(null);
    } finally {
      setSiLoading(false);
    }
  }, [activeSpotId, onSessionInvalidated]);

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
      await createObservation({
        spotId: activeSpotId ?? undefined,
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

      {!activeSpotId ? (
        <Card title="선택된 명소 없음" description="지도에서 마커를 누르거나 홈에 기본 명소를 설정하세요">
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
            EXPO_PUBLIC_DEFAULT_SPOT_ID 또는 지도에서 명소를 고르면 Star-Index를 불러올 수 있습니다.
          </Text>
        </Card>
      ) : (
        <Card title="현재 Star-Index" description={siData?.name}>
          {siLoading ? (
            <ActivityIndicator color={theme.starGold} />
          ) : siErr ? (
            <Text style={{ color: theme.destructive }}>{siErr}</Text>
          ) : siData ? (
            <Text style={{ color: theme.foreground, fontSize: 28 }}>
              {siData.score}
            </Text>
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
                {row.result} · SI {row.starIndexVal}
              </Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 4 }}>
                {new Date(row.observedAt).toLocaleString('ko-KR')}
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

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';
import {
  ApiRequestError,
  fetchSkyView,
  SessionExpiredError,
  type SkyViewResponseDto,
} from '../../lib/api-client';

/** IAU 별자리 3글자 약어 → 한글(주요 별군만) */
const CON_LABEL_KO: Record<string, string> = {
  Ori: '오리온',
  Aur: '마차부',
  Tau: '황소',
  Gem: '쌍둥이',
  CMi: '작은개',
  CMa: '큰개',
  Car: '용골',
  Cen: '센타우루스',
  Cru: '남십자',
  Vir: '처녀',
  Lyr: '거문고',
  Cyg: '백조',
  Aql: '독수리',
  UMi: '작은곰',
  Boo: '목동',
  Sco: '전갈',
  UMa: '큰곰',
  PsA: '남쪽물고기',
  Pup: '고물',
};

export interface SkyTabScreenProps {
  observerLat: number | null;
  observerLng: number | null;
  observeAtIso: string;
  onShiftHours: (deltaHours: number) => void;
  onNowUtc: () => void;
  onSessionInvalidated: () => Promise<void>;
}

/** 북=0° 동=90° 고도·방위 → 0~100 정규화 천구 원 투영(지평선 위만 표시용) */
function azAltToNorm(azDeg: number, altDeg: number): { nx: number; ny: number } {
  const r = Math.max(0, Math.min(48, ((90 - altDeg) / 90) * 46));
  const az = (azDeg * Math.PI) / 180;
  return {
    nx: 50 + r * Math.sin(az),
    ny: 50 - r * Math.cos(az),
  };
}

function magToRadius(mag: number): number {
  const t = Math.max(-2, Math.min(6, mag));
  return Math.max(0.55, 2.4 - t * 0.28);
}

export function SkyTabScreen({
  observerLat,
  observerLng,
  observeAtIso,
  onShiftHours,
  onNowUtc,
  onSessionInvalidated,
}: SkyTabScreenProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SkyViewResponseDto | null>(null);

  const load = useCallback(async () => {
    if (observerLat == null || observerLng == null) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const v = await fetchSkyView({
        lat: observerLat,
        lng: observerLng,
        at: observeAtIso,
      });
      setData(v);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setErr(e.message);
      } else {
        setErr('천구 데이터를 불러오지 못했습니다.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [observerLat, observerLng, observeAtIso, onSessionInvalidated]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasObserver =
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.foreground }]}>가상 밤하늘</Text>
      <Text style={[styles.sub, { color: theme.mutedForeground }]}>
        위치·시각(UTC) 기준 지평선 상 별 + 별자리 라벨 MVP — GET /sky/view
      </Text>

      {!hasObserver ? (
        <Card title="관측 위치 필요" description="홈에서 Star-Index를 불러오거나 지도에서 명소를 고르세요">
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
            기준 명소의 위도·경도가 있어야 천구를 그릴 수 있습니다.
          </Text>
        </Card>
      ) : (
        <>
          <Card title="시각 (UTC)" description={observeAtIso.slice(0, 19) + 'Z'}>
            <View style={styles.row}>
              <Button label="−6h" variant="outline" size="sm" onPress={() => onShiftHours(-6)} />
              <Button label="−1h" variant="outline" size="sm" onPress={() => onShiftHours(-1)} />
              <Button label="지금(UTC)" variant="secondary" size="sm" onPress={onNowUtc} />
              <Button label="+1h" variant="outline" size="sm" onPress={() => onShiftHours(1)} />
              <Button label="+6h" variant="outline" size="sm" onPress={() => onShiftHours(6)} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Button
                label="다시 불러오기"
                variant="ghost"
                size="sm"
                onPress={() => void load()}
                disabled={loading}
              />
            </View>
          </Card>

          {loading ? (
            <ActivityIndicator color={theme.starGold} style={{ marginVertical: 16 }} />
          ) : null}
          {err ? (
            <Text style={{ color: theme.destructive, marginBottom: 8 }}>{err}</Text>
          ) : null}

          {data ? (
            <>
              <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                LST {data.lstDeg.toFixed(2)}° · JD {data.jd.toFixed(5)} · 가시 별{' '}
                {data.stars.filter((s) => s.visible).length}/{data.stars.length}
              </Text>
              <View style={[styles.skyWrap, { borderColor: theme.border }]}>
                <Svg width="100%" height={340} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  <Circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill={theme.background}
                    stroke={theme.border}
                    strokeWidth="0.35"
                  />
                  <Circle cx="50" cy="50" r="1.2" fill={theme.starGold} />
                  {data.stars
                    .filter((s) => s.visible)
                    .map((s) => {
                      const { nx, ny } = azAltToNorm(s.azDeg, s.altDeg);
                      const rr = magToRadius(s.mag);
                      return (
                        <Circle
                          key={s.hip}
                          cx={nx}
                          cy={ny}
                          r={rr}
                          fill={theme.foreground}
                          opacity={0.92}
                        />
                      );
                    })}
                  {data.constellationLabels.map((lb) => {
                    const { nx, ny } = azAltToNorm(lb.azDeg, lb.altDeg);
                    const label = CON_LABEL_KO[lb.con] ?? lb.con;
                    return (
                      <SvgText
                        key={lb.con}
                        x={nx}
                        y={Math.max(6, ny - 4)}
                        fill={theme.starGold}
                        fontSize="3.2"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {label}
                      </SvgText>
                    );
                  })}
                </Svg>
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 6 },
  sub: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  meta: { fontSize: 11, marginBottom: 8, fontFamily: 'SpaceMono-Regular' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skyWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
});

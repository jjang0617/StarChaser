/**
 * 온보딩 3단계: (1) 위치 권한 또는 도·시군구 목록 선택 (2) 알림 종류 토글 (3) 관심 별자리
 * 완료 시 AsyncStorage에 지역·알림 prefs·관심 배열 저장 후 onDone.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button, Card, Screen } from '../ui';
import { useTheme } from '../../themes/ThemeContext';
import { SelectField } from './SelectField';
import {
  doToGu,
  inferDoFromReverseGeocode,
  koreaDoOptions,
  type KoreaDo,
} from './koreaRegions';

type Step = 1 | 2 | 3;

/** 저장되는 지역 스냅샷 (위치 허용 시 역지오코딩으로 채우거나 목록에서 선택) */
type OnboardingRegion = {
  do: KoreaDo | '';
  region: string;
};

/** Step2에서 고른 알림 채널 (나중에 푸시/로컬 알림 연동 시 사용) */
type NotificationPrefs = {
  starIndex70: boolean;
  meteorEvents: boolean;
  weeklyTop5: boolean;
};

// AsyncStorage 키 (App.tsx reset과 동일하게 유지)
const KEY_COMPLETED = 'starChaser:onboardingCompleted';
const KEY_REGION = 'starChaser:onboardingRegion';
const KEY_NOTIF_PREFS = 'starChaser:notificationPrefs';
const KEY_INTERESTS = 'starChaser:onboardInterests';

// Step3 칩 목록 (표시 순서 고정)
const STAR_CONSTELLATIONS = [
  '오리온자리',
  '카시오페이아자리',
  '큰곰자리',
  '작은곰자리',
  '백조자리',
  '거문고자리',
  '독수리자리',
  '황소자리',
  '쌍둥이자리',
  '게자리',
  '사자자리',
  '처녀자리',
  '물고기자리',
  '양자리',
  '궁수자리',
] as const;

// Step2 토글 행: NotificationPrefs 키와 카피 매핑
const NOTIF_ITEMS: Array<{
  key: keyof NotificationPrefs;
  title: string;
  desc: string;
}> = [
  {
    key: 'starIndex70',
    title: '오늘 밤, 볼 만한 날만',
    desc: '별 보기 좋은 날(점수가 70 넘을 때)에만 살짝 알려줄게요.',
  },
  {
    key: 'meteorEvents',
    title: '하늘 이벤트 소식',
    desc: '유성우, 월식 같은 특별한 날 + ISS 지나갈 때도 알려드려요.',
  },
  {
    key: 'weeklyTop5',
    title: '이번 주 가볼 만한 곳',
    desc: '매주 월요일 아침 7시, 이번 주 추천 명소 다섯 곳만 정리해서 보내요.',
  },
];

/** expo-location 역지오코딩: 플랫폼마다 district / subregion / region 중 하나에 시·군·구 성격 문자열이 옴 */
function districtFromGeocode(addr: Record<string, unknown> | undefined): string {
  if (!addr) return '';
  return (
    (addr.district as string | undefined) ||
    (addr.subregion as string | undefined) ||
    (addr.region as string | undefined) ||
    ''
  );
}

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>(1);
  /** 저장/완료·위치 요청 중 버튼 비활성 등 */
  const [busy, setBusy] = useState(false);

  // --- Step1: 지역 ---
  const [regionDo, setRegionDo] = useState<KoreaDo | ''>('');
  const [regionName, setRegionName] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  /** true는 반드시 「목록에서 지역 선택하기」로만 켬 (위치 거부 시 자동 오픈 안 함 → OS 팝업만 없을 때와 구분) */
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // --- Step2: 알림 종류 UI만 (시스템 알림 권한은 추후 dev build 등에서 연동 가능) ---
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    starIndex70: true,
    meteorEvents: true,
    weeklyTop5: true,
  });

  // --- Step3 ---
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const guOptions = useMemo(() => (regionDo ? doToGu[regionDo] : []), [regionDo]);

  /** 위치 허용됐거나, 도+시군구를 목록에서 모두 고른 경우 */
  const canProceedStep1 =
    locationStatus === 'granted' || (Boolean(regionDo) && Boolean(regionName.trim()));
  const canProceedStep3 = selectedInterests.length >= 1;

  const toggleInterest = useCallback((key: string) => {
    setSelectedInterests(prev =>
      prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key],
    );
  }, []);

  /**
   * OS 위치 권한 팝업 → 허용 시 즉시 Step2.
   * 좌표·역지오코딩으로 도/시군구 추정은 await 하지 않고 백그라운드에서만 수행.
   */
  const requestLocationAndInfer = useCallback(async () => {
    try {
      setBusy(true);
      setLocationStatus('idle');
      setShowRegionPicker(false);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        // 거부 직후 showRegionPicker 켜지 않음 → 목록 버튼과 동일 UX로 보이는 문제 방지
        return;
      }

      setLocationStatus('granted');
      setStep(2);

      void (async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const [addr] = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          const rec = (addr ?? {}) as Record<string, unknown>;
          const inferredDo = inferDoFromReverseGeocode(rec);
          if (inferredDo) setRegionDo(inferredDo);

          const district = districtFromGeocode(rec);
          if (inferredDo && district) {
            const options = doToGu[inferredDo];
            const found =
              options.find(opt => district.includes(opt)) ||
              options.find(opt => {
                const short = opt.replace(/^창원시\s+/, '');
                return short !== opt && district.includes(short);
              });
            if (found) setRegionName(found);
          }
        } catch {
          // 권한은 이미 허용됨; 역지오코딩 실패 시 사용자는 Step1 목록으로 보정 가능
        }
      })();
    } catch {
      setLocationStatus('error');
    } finally {
      setBusy(false);
    }
  }, []);

  /** 건너뛰기 시 interestsOverride로 빈 배열 등 전달 가능 */
  const finishOnboarding = useCallback(
    async (interestsOverride?: string[]) => {
      setBusy(true);
      try {
        const interests = interestsOverride ?? selectedInterests;
        const region: OnboardingRegion = {
          do: regionDo,
          region: regionName.trim(),
        };

        await Promise.all([
          AsyncStorage.setItem(KEY_COMPLETED, 'true'),
          AsyncStorage.setItem(KEY_REGION, JSON.stringify(region)),
          AsyncStorage.setItem(KEY_NOTIF_PREFS, JSON.stringify(notifPrefs)),
          AsyncStorage.setItem(KEY_INTERESTS, JSON.stringify(interests)),
        ]);

        onDone();
      } finally {
        setBusy(false);
      }
    },
    [notifPrefs, onDone, regionDo, regionName, selectedInterests],
  );

  return (
    <Screen noPadding={false}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={[styles.stepText, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
            STEP {step} / 3
          </Text>
          <Text style={[styles.title, { color: theme.foreground }]}>
            {step === 1 ? '위치 권한 & 지역 선택' : step === 2 ? '알림 설정' : '관심 별자리 선택'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            {step === 1
              ? '위치 권한을 허용하거나, 「목록에서 지역 선택하기」로 도·시·군·구만 고를 수 있어요. 건너뛰기도 가능해요.'
              : step === 2
                ? '받고 싶은 소식만 골라 주세요. 다음에서 관심 별자리를 고를 수 있어요.'
                : '관심 있는 별자리를 몇 개 골라 주세요. 나중에 바꿀 수 있어요.'}
          </Text>
        </View>

        <View style={{ gap: 12, marginTop: 10 }}>
          {/* Step1: 위치 권한 플로우 vs 목록에서 도·시군구 (상호 배타적으로 목록은 버튼으로만 펼침) */}
          {step === 1 && (
            <Card title="Step 1" description="위치 허용 또는 지역 선택">
              <View style={styles.cardInner}>
                <Button
                  label="위치 권한 요청"
                  variant="primary"
                  fullWidth
                  onPress={requestLocationAndInfer}
                  disabled={busy}
                  loading={busy}
                />

                <Button
                  label="목록에서 지역 선택하기"
                  variant="outline"
                  fullWidth
                  onPress={() => setShowRegionPicker(true)}
                  disabled={busy || showRegionPicker}
                />

                {showRegionPicker && (
                  <View style={styles.regionPickerStack}>
                    <Text style={[styles.regionPickerLead, { color: theme.moonlight }]}>
                      <Text style={{ color: theme.starGold, fontWeight: '700' }}>도</Text>
                      {' → '}
                      <Text style={{ color: theme.starGold, fontWeight: '700' }}>시·군·구</Text>
                      를 차례로 골라 주세요.
                    </Text>
                    <SelectField
                      emphasized
                      label="도"
                      value={regionDo || undefined}
                      placeholder="탭해서 도 선택"
                      options={[...koreaDoOptions]}
                      onChange={next => {
                        setRegionDo(next as KoreaDo);
                        setRegionName('');
                      }}
                    />
                    <SelectField
                      emphasized
                      disabled={!regionDo}
                      label="시·군·구"
                      value={regionName || undefined}
                      placeholder={regionDo ? '탭해서 시·군·구 선택' : '먼저 도를 선택해 주세요'}
                      options={guOptions}
                      onChange={setRegionName}
                      style={{ marginTop: 2 }}
                    />
                  </View>
                )}

                {locationStatus === 'error' && (
                  <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                    위치를 가져오지 못했어요. 「목록에서 지역 선택하기」를 눌러 도·시·군·구를 골라 주세요.
                  </Text>
                )}

                {locationStatus === 'denied' && (
                  <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                    위치를 안 켜도 괜찮아요. 「목록에서 지역 선택하기」를 눌러 시·군·구를 골라 주세요.
                  </Text>
                )}

                <View style={styles.btnRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="건너뛰기"
                      variant="outline"
                      fullWidth
                      size="sm"
                      onPress={() => setStep(2)}
                      disabled={busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="다음"
                      fullWidth
                      size="sm"
                      onPress={() => setStep(2)}
                      disabled={busy || !canProceedStep1}
                    />
                  </View>
                </View>
              </View>
            </Card>
          )}

          {/* Step2: 알림 prefs만 저장; 시스템 알림 권한 팝업은 현재 호출하지 않음 */}
          {step === 2 && (
            <Card title="Step 2" description="받을 알림만 골라요">
              <View style={styles.cardInner}>
                <View style={styles.toggleList}>
                  {NOTIF_ITEMS.map(item => {
                    const enabled = notifPrefs[item.key];
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() =>
                          setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        style={({ pressed }) => [
                          styles.toggleRow,
                          {
                            borderColor: enabled ? theme.ring : theme.border,
                            backgroundColor: enabled ? theme.input : 'transparent',
                            opacity: pressed ? 0.92 : 1,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.toggleTitle, { color: theme.foreground }]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.toggleDesc, { color: theme.mutedForeground }]}>
                            {item.desc}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.toggleMark,
                            {
                              borderColor: enabled ? theme.starGold : theme.border,
                              backgroundColor: enabled ? theme.starGold : 'transparent',
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.btnRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="건너뛰기"
                      variant="outline"
                      fullWidth
                      size="sm"
                      onPress={() => {
                        // 건너뛰기 = 알림 채널 전부 끔으로 저장
                        setNotifPrefs({ starIndex70: false, meteorEvents: false, weeklyTop5: false });
                        setStep(3);
                      }}
                      disabled={busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="다음"
                      fullWidth
                      size="sm"
                      onPress={() => setStep(3)}
                      disabled={busy}
                    />
                  </View>
                </View>
              </View>
            </Card>
          )}

          {/* Step3: 별자리 복수 선택 · 완료 시 finishOnboarding / 건너뛰기는 빈 관심으로 완료 */}
          {step === 3 && (
            <Card title="Step 3" description="관심 별자리(복수 선택)">
              <View style={styles.cardInner}>
                <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                  선택한 별자리는 알림 우선순위에 활용됩니다.
                </Text>

                <View style={styles.chips}>
                  {STAR_CONSTELLATIONS.map(c => {
                    const selected = selectedInterests.includes(c);
                    return (
                      <Pressable
                        key={c}
                        onPress={() => toggleInterest(c)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            borderColor: selected ? theme.ring : theme.border,
                            backgroundColor: selected ? theme.input : 'transparent',
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: selected ? theme.ring : theme.mutedForeground,
                              fontFamily: selected ? 'SpaceMono-Regular' : undefined,
                            },
                          ]}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.btnRowTriple}>
                  <View style={styles.btnTripleCell}>
                    <Button
                      label="뒤로"
                      variant="outline"
                      fullWidth
                      size="sm"
                      onPress={() => setStep(2)}
                      disabled={busy}
                    />
                  </View>
                  <View style={styles.btnTripleCell}>
                    <Button
                      label="건너뛰기"
                      variant="outline"
                      fullWidth
                      size="sm"
                      onPress={() => finishOnboarding([])}
                      disabled={busy}
                    />
                  </View>
                  <View style={styles.btnTripleCell}>
                    <Button
                      label="완료"
                      fullWidth
                      size="sm"
                      onPress={() => finishOnboarding()}
                      disabled={busy || !canProceedStep3}
                      loading={busy}
                    />
                  </View>
                </View>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

// 레이아웃·간격만; 색은 대부분 theme 인라인
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 14,
  },
  top: {
    gap: 8,
  },
  stepText: {
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardInner: {
    gap: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnRowTriple: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  btnTripleCell: {
    flex: 1,
    minWidth: 0,
  },
  regionPickerStack: {
    marginTop: 4,
    gap: 10,
  },
  regionPickerLead: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  toggleList: {
    gap: 10,
    marginTop: 6,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  toggleMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import {
  ApiRequestError,
  SessionExpiredError,
  authorizedGetJson,
  authorizedPutJson,
} from '../../lib/api-client';
import type { NotificationPreferenceDto, SpotDto } from '../../lib/types/api';
import { fetchSpotsAll } from '../../lib/spots-api';
import { Button, Card } from '../ui';

interface ProfileTabScreenProps {
  email: string | null;
  onLogout: () => void;
  isRedMode: boolean;
  onToggleRedMode: () => void;
  onSessionInvalidated: () => Promise<void>;
  onDevResetOnboarding?: () => void;
}

export function ProfileTabScreen({
  email,
  onLogout,
  isRedMode,
  onToggleRedMode,
  onSessionInvalidated,
  onDevResetOnboarding,
}: ProfileTabScreenProps) {
  const { theme } = useTheme();
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferenceDto | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [spots, setSpots] = useState<SpotDto[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [spotPickerOpen, setSpotPickerOpen] = useState(false);

  const loadPrefs = useCallback(async () => {
    setPrefsError(null);
    setPrefsLoading(true);
    try {
      const data = await authorizedGetJson<NotificationPreferenceDto>(
        '/notifications/preferences',
      );
      setPrefs(data);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      const msg =
        e instanceof ApiRequestError ? e.message : '알림 설정을 불러오지 못했습니다.';
      setPrefsError(msg);
      setPrefs(null);
    } finally {
      setPrefsLoading(false);
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    let cancelled = false;
    setSpotsLoading(true);
    void (async () => {
      try {
        const list = await fetchSpotsAll();
        if (!cancelled) setSpots(list);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        if (!cancelled && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[ProfileTabScreen] 명소 목록 로드 실패', e);
        }
      } finally {
        if (!cancelled) setSpotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSessionInvalidated]);

  const alertSpotLabel = useMemo(() => {
    const id = prefs?.alertSpotId;
    if (!id) return '선택 안 함';
    const s = spots.find(x => x.id === id);
    return s?.name ?? '선택한 명소';
  }, [prefs?.alertSpotId, spots]);

  const sortedSpots = useMemo(() => {
    return [...spots].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [spots]);

  const persistPrefs = useCallback(
    async (next: NotificationPreferenceDto) => {
      setPrefsSaving(true);
      setPrefsError(null);
      try {
        const saved = await authorizedPutJson<NotificationPreferenceDto>(
          '/notifications/preferences',
          {
            alertsEnabled: next.alertsEnabled,
            starIndexAlertEnabled: next.starIndexAlertEnabled,
            astronomyEventAlertEnabled: next.astronomyEventAlertEnabled,
            top5AlertEnabled: next.top5AlertEnabled,
            alertSpotId: next.alertSpotId ?? null,
          },
        );
        setPrefs(saved);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        const msg =
          e instanceof ApiRequestError ? e.message : '저장에 실패했습니다.';
        setPrefsError(msg);
        await loadPrefs();
      } finally {
        setPrefsSaving(false);
      }
    },
    [loadPrefs, onSessionInvalidated],
  );

  const toggleField = useCallback(
    (
      key: keyof Pick<
        NotificationPreferenceDto,
        | 'alertsEnabled'
        | 'starIndexAlertEnabled'
        | 'astronomyEventAlertEnabled'
        | 'top5AlertEnabled'
      >,
      value: boolean,
    ) => {
      if (!prefs) return;
      const next = { ...prefs, [key]: value };
      if (key === 'alertsEnabled' && value === false) {
        next.starIndexAlertEnabled = false;
        next.astronomyEventAlertEnabled = false;
        next.top5AlertEnabled = false;
        next.alertSpotId = null;
      }
      setPrefs(next);
      void persistPrefs(next);
    },
    [persistPrefs, prefs],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.foreground }]}>마이페이지</Text>
      <Card
        title="계정"
        description="설정·Pro 등은 Phase 1 이후(B 담당 영역과 통합)"
      >
        <Text style={[styles.email, { color: theme.mutedForeground }]}>
          {email ?? '—'}
        </Text>
        <View style={{ marginTop: 12 }}>
          <Button label="로그아웃" variant="outline" fullWidth onPress={onLogout} />
        </View>
      </Card>

      <Card
        title="알림 (서버 연동)"
        description="온보딩에서 고른 항목과 동기됩니다. 이벤트 푸시는 서버 스케줄러에서 이 설정을 따릅니다."
      >
        {prefsLoading ? (
          <ActivityIndicator color={theme.starGold} style={{ marginVertical: 12 }} />
        ) : prefs ? (
          <View style={{ gap: 14 }}>
            {prefsError ? (
              <Text style={[styles.err, { color: theme.destructive }]}>{prefsError}</Text>
            ) : null}
            <Row
              label="푸시 알림 전체"
              description="끄면 세부 항목도 모두 꺼집니다."
              value={prefs.alertsEnabled}
              disabled={prefsSaving}
              theme={theme}
              onValueChange={(v) => toggleField('alertsEnabled', v)}
            />
            <Row
              label="별 보기 좋은 날 (Star-Index)"
              description="기준 명소의 점수가 서버 설정 임계 이상일 때 하루 한 번 알림"
              value={prefs.starIndexAlertEnabled}
              disabled={prefsSaving || !prefs.alertsEnabled}
              theme={theme}
              onValueChange={(v) => toggleField('starIndexAlertEnabled', v)}
            />
            <View style={{ gap: 8, opacity: prefs.alertsEnabled ? 1 : 0.45 }}>
              <Text style={[styles.spotHint, { color: theme.mutedForeground }]}>
                기준 명소: {spotsLoading ? '목록 불러오는 중…' : alertSpotLabel}
              </Text>
              <Button
                label="기준 명소 선택"
                variant="outline"
                fullWidth
                disabled={
                  prefsSaving || !prefs.alertsEnabled || spotsLoading || spots.length === 0
                }
                onPress={() => setSpotPickerOpen(true)}
              />
            </View>
            <Row
              label="하늘 이벤트"
              description="유성우·특별 천체 등"
              value={prefs.astronomyEventAlertEnabled}
              disabled={prefsSaving || !prefs.alertsEnabled}
              theme={theme}
              onValueChange={(v) => toggleField('astronomyEventAlertEnabled', v)}
            />
            <Row
              label="주간 TOP5"
              description="주간 추천 명소 요약"
              value={prefs.top5AlertEnabled}
              disabled={prefsSaving || !prefs.alertsEnabled}
              theme={theme}
              onValueChange={(v) => toggleField('top5AlertEnabled', v)}
            />
          </View>
        ) : (
          <View>
            {prefsError ? (
              <Text style={[styles.err, { color: theme.destructive }]}>{prefsError}</Text>
            ) : null}
            <Button label="다시 불러오기" variant="outline" fullWidth onPress={loadPrefs} />
          </View>
        )}
      </Card>

      <Modal
        visible={spotPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpotPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSpotPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={e => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              Star-Index 알림 기준 명소
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Pressable
                onPress={() => {
                  setSpotPickerOpen(false);
                  if (!prefs) return;
                  void persistPrefs({ ...prefs, alertSpotId: null });
                }}
                style={({ pressed }) => [
                  styles.modalRow,
                  {
                    borderBottomColor: theme.border,
                    backgroundColor: pressed ? theme.muted : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: theme.foreground }}>선택 안 함</Text>
              </Pressable>
              {sortedSpots.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSpotPickerOpen(false);
                    if (!prefs) return;
                    void persistPrefs({ ...prefs, alertSpotId: s.id });
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: pressed ? theme.muted : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: theme.foreground }}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Card title="표시" description="야간 관측 시 눈부심을 줄입니다">
        <Button
          label={isRedMode ? '야간 모드(Night Vision) 해제' : '야간 모드(Night Vision) 켜기'}
          variant="red"
          fullWidth
          onPress={onToggleRedMode}
        />
      </Card>
      {onDevResetOnboarding ? (
        <Card title="개발" description="온보딩 플로우만 다시 봅니다">
          <Button
            label="DEV: 온보딩 다시보기"
            variant="outline"
            fullWidth
            onPress={onDevResetOnboarding}
          />
        </Card>
      ) : null}
    </View>
  );
}

function Row({
  label,
  description,
  value,
  disabled,
  theme,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  theme: ThemeTokens;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[rowStyles.label, { color: theme.foreground }]}>{label}</Text>
        <Text style={[rowStyles.desc, { color: theme.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: theme.muted, true: theme.primary }}
        thumbColor={theme.cardForeground}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 16 },
  email: { fontSize: 14 },
  err: { fontSize: 13, marginBottom: 8 },
  spotHint: { fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import type { NotificationPreferenceDto } from '../../lib/types/api';
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
              description="점수가 좋을 때 알림"
              value={prefs.starIndexAlertEnabled}
              disabled={prefsSaving || !prefs.alertsEnabled}
              theme={theme}
              onValueChange={(v) => toggleField('starIndexAlertEnabled', v)}
            />
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
});

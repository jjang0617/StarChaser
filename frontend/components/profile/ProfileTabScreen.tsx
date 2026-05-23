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
  fetchMyProfile,
} from '../../lib/api-client';
import type { NotificationPreferenceDto, SpotDto, UserProfileDto } from '../../lib/types/api';
import { useAuth } from '../../contexts/auth-context';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileChangePasswordModal } from './ProfileChangePasswordModal';
import { ProfileDeleteAccountModal } from './ProfileDeleteAccountModal';
import { fetchSpotsAll } from '../../lib/spots-api';
import { PhotographyGuideModal } from '../guide/PhotographyGuideModal';
import { Button, Card } from '../ui';

interface ProfileTabScreenProps {
  onLogout: () => void;
  isRedMode: boolean;
  onToggleRedMode: () => void;
  onSessionInvalidated: () => Promise<void>;
  onDevResetOnboarding?: () => void;
}

export function ProfileTabScreen({
  onLogout,
  isRedMode,
  onToggleRedMode,
  onSessionInvalidated,
  onDevResetOnboarding,
}: ProfileTabScreenProps) {
  const { theme } = useTheme();
  const { applyProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferenceDto | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [spots, setSpots] = useState<SpotDto[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [spotPickerOpen, setSpotPickerOpen] = useState(false);
  const [photographyGuideOpen, setPhotographyGuideOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    setProfileLoading(true);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      await applyProfile(data);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setProfileError(
        e instanceof ApiRequestError ? e.message : '프로필을 불러오지 못했습니다.',
      );
    } finally {
      setProfileLoading(false);
    }
  }, [applyProfile, onSessionInvalidated]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
            top3AlertEnabled: next.top3AlertEnabled,
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
        | 'top3AlertEnabled'
      >,
      value: boolean,
    ) => {
      if (!prefs) return;
      const next = { ...prefs, [key]: value };
      if (key === 'alertsEnabled' && value === false) {
        next.starIndexAlertEnabled = false;
        next.astronomyEventAlertEnabled = false;
        next.top3AlertEnabled = false;
        next.alertSpotId = null;
      }
      setPrefs(next);
      void persistPrefs(next);
    },
    [persistPrefs, prefs],
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
      <Text style={[styles.title, { color: theme.foreground }]}>마이페이지</Text>
      <Card title="프로필">
        {profileLoading ? (
          <ActivityIndicator color={theme.starGold} style={{ marginVertical: 12 }} />
        ) : profile ? (
          <View style={styles.profileBlock}>
            <ProfileAvatar
              nickname={profile.nickname}
              avatarUrl={profile.avatarUrl}
              size={72}
            />
            <View style={styles.profileMeta}>
              <Text style={[styles.nickname, { color: theme.foreground }]}>
                {profile.nickname?.trim() || '닉네임 없음'}
              </Text>
              <Text style={[styles.email, { color: theme.mutedForeground }]}>
                {profile.email}
              </Text>
            </View>
            <Button
              label="프로필 수정"
              variant="outline"
              size="sm"
              fullWidth
              onPress={() => setEditOpen(true)}
            />
            <Button
              label="비밀번호 변경"
              variant="outline"
              size="sm"
              fullWidth
              onPress={() => {
                setPasswordSuccessMsg(null);
                setPasswordOpen(true);
              }}
            />
            {passwordSuccessMsg ? (
              <Text style={[styles.successMsg, { color: theme.starGold }]}>
                {passwordSuccessMsg}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {profileError ? (
              <Text style={[styles.err, { color: theme.destructive }]}>{profileError}</Text>
            ) : null}
            <Button label="다시 불러오기" variant="outline" fullWidth onPress={() => void loadProfile()} />
          </View>
        )}
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
              label="주간 TOP3"
              description="주간 추천 명소 요약"
              value={prefs.top3AlertEnabled}
              disabled={prefsSaving || !prefs.alertsEnabled}
              theme={theme}
              onValueChange={(v) => toggleField('top3AlertEnabled', v)}
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

      <Card
        title="촬영 가이드"
        description="별·야경·유성우 촬영 시 참고할 기본 설정과 안전 안내입니다."
      >
        <Button
          label="별·야경 촬영 기본 가이드 보기"
          variant="outline"
          fullWidth
          onPress={() => setPhotographyGuideOpen(true)}
        />
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

      <Card title="회원 탈퇴" description="탈퇴 시 계정과 모든 데이터가 삭제되며 복구할 수 없습니다.">
        <Button
          label="회원 탈퇴"
          variant="destructive"
          size="sm"
          fullWidth
          onPress={() => setDeleteOpen(true)}
        />
      </Card>
      </ScrollView>

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

      <PhotographyGuideModal
        visible={photographyGuideOpen}
        onClose={() => setPhotographyGuideOpen(false)}
      />

      {profile ? (
        <ProfileEditModal
          visible={editOpen}
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setProfile(next);
            void applyProfile(next);
          }}
        />
      ) : null}

      <ProfileChangePasswordModal
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSuccess={(message) => setPasswordSuccessMsg(message)}
      />

      <ProfileDeleteAccountModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          onLogout();
        }}
      />
    </>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 16 },
  profileBlock: { gap: 12, alignItems: 'center' },
  profileMeta: { alignItems: 'center', gap: 4 },
  nickname: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 13 },
  successMsg: { fontSize: 12, textAlign: 'center' },
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

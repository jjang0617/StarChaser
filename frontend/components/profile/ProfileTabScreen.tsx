import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { locationStarIndexAlertMeSubtitle } from '../../lib/notification-copy';
import {
  normalizeStarIndexAlertThreshold,
  type StarIndexAlertThreshold,
} from '../../lib/star-index-alert-threshold';
import { StarIndexAlertThresholdPicker } from '../notifications/StarIndexAlertThresholdPicker';
import {
  glassCardStyle,
  spacing,
  typography,
} from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { dangerAccent, type ThemeTokens } from '../../themes/themes';
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
import { ProfileAppInfoCard } from './ProfileAppInfoCard';
import { ProfileMySpotsCard } from './ProfileMySpotsCard';
import { ProfileSection } from './ProfileSection';
import { fetchSpotsAll } from '../../lib/spots-api';
import { PhotographyGuideModal } from '../guide/PhotographyGuideModal';
import { AppAlertModal } from '../ui/AppAlertModal';
import { AppToggle } from '../ui/AppToggle';
import { GlassCard } from '../ui/GlassCard';
import { ProfileSettingIcon, type ProfileSettingIconName } from './ProfileSettingIcon';

interface ProfileTabScreenProps {
  onLogout: () => void;
  isRedMode: boolean;
  onToggleRedMode: () => void;
  onSessionInvalidated: () => Promise<void>;
  locationEnabled: boolean;
  locationPrefLoaded: boolean;
  locationPermissionStatus: Location.PermissionResponse['status'] | null;
  locationToggleBusy: boolean;
  onLocationEnabledChange: (enabled: boolean) => void;
  onRefreshLocationStatus: () => Promise<Location.PermissionResponse['status']>;
  onOpenLocationSettings: () => void;
  spotActivityRevision: number;
  onOpenSpotDetail: (spotId: string) => void;
}

export function ProfileTabScreen({
  onLogout,
  isRedMode,
  onToggleRedMode,
  onSessionInvalidated,
  locationEnabled,
  locationPrefLoaded,
  locationPermissionStatus,
  locationToggleBusy,
  onLocationEnabledChange,
  onRefreshLocationStatus,
  onOpenLocationSettings,
  spotActivityRevision,
  onOpenSpotDetail,
}: ProfileTabScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, applyProfile, completeAccountDeletion } = useAuth();
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    void onRefreshLocationStatus();
  }, [onRefreshLocationStatus]);

  const locationStatusHint = useMemo(() => {
    if (!locationEnabled) {
      return '앱에서 GPS를 사용하지 않습니다. (시스템 권한과 별개)';
    }
    if (locationPermissionStatus === Location.PermissionStatus.GRANTED) {
      return '현재 위치를 천구·지도·관측 기록에 사용합니다.';
    }
    if (locationPermissionStatus === Location.PermissionStatus.DENIED) {
      return '앱에서 켜 두었지만 시스템에서 거부됨. 아래에서 설정을 열어 허용해 주세요.';
    }
    return '켜져 있음. 시스템 위치 권한을 허용하면 GPS를 사용합니다.';
  }, [locationEnabled, locationPermissionStatus]);

  const showLocationSettings =
    locationEnabled &&
    locationPermissionStatus === Location.PermissionStatus.DENIED;

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

  const loadMySpots = useCallback(async (cancelledRef: { cancelled: boolean }) => {
    setSpotsLoading(true);
    try {
      const list = await fetchSpotsAll();
      if (!cancelledRef.cancelled) setSpots(list);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (!cancelledRef.cancelled && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[ProfileTabScreen] 명소 목록 로드 실패', e);
      }
    } finally {
      if (!cancelledRef.cancelled) setSpotsLoading(false);
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPrefs(null);
      setSpots([]);
      setProfileLoading(false);
      setPrefsLoading(false);
      setSpotsLoading(false);
      return;
    }

    void loadProfile();
    void loadPrefs();

    const cancelledRef = { cancelled: false };
    void loadMySpots(cancelledRef);

    return () => {
      cancelledRef.cancelled = true;
    };
  }, [loadProfile, loadPrefs, loadMySpots, user?.id]);

  const alertSpotLabel = useMemo(() => {
    const id = prefs?.alertSpotId;
    if (!id) return '선택 안 함';
    const s = spots.find((x) => x.id === id);
    return s?.name ?? '선택한 명소';
  }, [prefs?.alertSpotId, spots]);

  const sortedSpots = useMemo(() => {
    return [...spots].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [spots]);

  const starIndexThreshold = normalizeStarIndexAlertThreshold(
    prefs?.starIndexAlertThreshold,
  );

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
            locationStarIndexAlertEnabled: next.locationStarIndexAlertEnabled ?? true,
            starIndexAlertThreshold: next.starIndexAlertThreshold ?? 90,
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
        | 'locationStarIndexAlertEnabled'
        | 'starIndexAlertEnabled'
      >,
      value: boolean,
    ) => {
      if (!prefs) return;
      const next = { ...prefs, [key]: value };
      if (key === 'alertsEnabled' && value === false) {
        next.locationStarIndexAlertEnabled = false;
        next.starIndexAlertEnabled = false;
        next.alertSpotId = null;
      }
      setPrefs(next);
      void persistPrefs(next);
    },
    [persistPrefs, prefs],
  );

  const selectThreshold = useCallback(
    (threshold: StarIndexAlertThreshold) => {
      if (!prefs || prefsSaving || starIndexThreshold === threshold) return;
      void persistPrefs({ ...prefs, starIndexAlertThreshold: threshold });
    },
    [persistPrefs, prefs, prefsSaving, starIndexThreshold],
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 12) + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          {profileLoading ? (
            <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 12 }} />
          ) : profile ? (
            <>
              <ProfileAvatar
                nickname={profile.nickname}
                avatarUrl={profile.avatarUrl}
                size={64}
              />
              <View style={styles.profileText}>
                <Text style={[styles.profileName, { color: theme.foreground }]}>
                  {profile.nickname?.trim() || '닉네임 없음'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.mutedForeground }]}>
                  {profile.kakaoId ? '카카오 계정' : profile.email}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, gap: 8 }}>
              {profileError ? (
                <Text style={[styles.errBanner, { color: theme.destructive }]}>
                  {profileError}
                </Text>
              ) : null}
              <Pressable onPress={() => void loadProfile()}>
                <Text style={{ color: theme.primaryGlow }}>프로필 다시 불러오기</Text>
              </Pressable>
            </View>
          )}
        </View>

        {profile ? (
          <GlassCard padding={8} style={styles.profileActionsCard}>
            <SettingRow
              theme={theme}
              icon="user"
              title="프로필 수정"
              subtitle="사진·닉네임 변경"
              chevron
              onPress={() => setEditOpen(true)}
            />
            {!profile.kakaoId ? (
              <SettingRow
                theme={theme}
                icon="shield"
                title="비밀번호 변경"
                chevron
                onPress={() => {
                  setPasswordSuccessMsg(null);
                  setPasswordOpen(true);
                }}
              />
            ) : null}
            {!profile.kakaoId && passwordSuccessMsg ? (
              <Text style={[styles.passwordSuccess, { color: theme.primaryGlow }]}>
                {passwordSuccessMsg}
              </Text>
            ) : null}
          </GlassCard>
        ) : null}

        {prefsError ? (
          <Text style={[styles.errBanner, { color: theme.destructive }]}>{prefsError}</Text>
        ) : null}

        <ProfileSection title="알림 설정" theme={theme}>
          {prefsLoading ? (
            <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 16 }} />
          ) : prefs ? (
            <GlassCard padding={8}>
              <SettingRow
                theme={theme}
                icon="bell"
                title="푸시 알림"
                subtitle="앱 알림 수신 여부"
                toggle
                value={prefs.alertsEnabled}
                disabled={prefsSaving}
                onToggle={(v) => toggleField('alertsEnabled', v)}
              />
              {prefs.alertsEnabled ? (
                <View style={styles.nested}>
                  <SettingRow
                    theme={theme}
                    icon="navigation"
                    title="위치한 곳 알림"
                    subtitle={locationStarIndexAlertMeSubtitle(
                      starIndexThreshold,
                      Boolean(
                        prefs.locationStarIndexAlertEnabled && prefs.alertsEnabled,
                      ),
                    )}
                    trailingText={
                      prefs.locationStarIndexAlertEnabled && prefs.alertsEnabled
                        ? `${starIndexThreshold}점+`
                        : undefined
                    }
                    toggle
                    value={prefs.locationStarIndexAlertEnabled ?? true}
                    disabled={prefsSaving}
                    onToggle={(v) => toggleField('locationStarIndexAlertEnabled', v)}
                  />
                  <SettingRow
                    theme={theme}
                    icon="star"
                    title="기준 명소 알림"
                    subtitle={
                      prefs.starIndexAlertEnabled && !prefs.alertSpotId
                        ? '기준 명소를 선택해야 알림이 발송됩니다'
                        : `기준 명소 점수가 ${starIndexThreshold}점 이상이면 하루 1회 알려 드려요`
                    }
                    toggle
                    value={prefs.starIndexAlertEnabled}
                    disabled={prefsSaving}
                    onToggle={(v) => {
                      toggleField('starIndexAlertEnabled', v);
                      if (v && !prefs.alertSpotId) {
                        setSpotPickerOpen(true);
                      }
                    }}
                  />
                  <StarIndexAlertThresholdPicker
                    selected={starIndexThreshold}
                    disabled={prefsSaving}
                    onSelect={selectThreshold}
                  />
                  <View style={styles.spotPickBlock}>
                    <Text style={[styles.spotPickLabel, { color: theme.mutedForeground }]}>
                      기준 명소: {spotsLoading ? '불러오는 중…' : alertSpotLabel}
                    </Text>
                    <Pressable
                      onPress={() => setSpotPickerOpen(true)}
                      disabled={
                        prefsSaving || !prefs.alertsEnabled || spotsLoading || spots.length === 0
                      }
                      style={({ pressed }) => [
                        styles.spotPickBtn,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: pressed
                            ? theme.inputBackground
                            : theme.primaryGlowMuted,
                          opacity:
                            prefsSaving || spotsLoading || spots.length === 0 ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: theme.primaryGlow, fontSize: 13, fontWeight: '500' }}>
                        기준 명소 선택
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </GlassCard>
          ) : (
            <Pressable onPress={loadPrefs} style={styles.retryWrap}>
              <Text style={{ color: theme.primaryGlow }}>다시 불러오기</Text>
            </Pressable>
          )}
        </ProfileSection>

        {Platform.OS !== 'web' ? (
          <ProfileSection title="위치" theme={theme}>
            {!locationPrefLoaded ? (
              <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 16 }} />
            ) : (
              <GlassCard padding={8}>
                <SettingRow
                  theme={theme}
                  icon="map-pin"
                  title="앱에서 위치 사용"
                  subtitle={locationStatusHint}
                  toggle
                  value={locationEnabled}
                  disabled={locationToggleBusy}
                  onToggle={onLocationEnabledChange}
                />
                {showLocationSettings ? (
                  <Pressable
                    onPress={onOpenLocationSettings}
                    style={({ pressed }) => [
                      styles.spotPickBtn,
                      {
                        marginHorizontal: spacing.sm,
                        marginTop: spacing.sm,
                        borderColor: theme.cardBorder,
                        backgroundColor: pressed
                          ? theme.inputBackground
                          : theme.primaryGlowMuted,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.primaryGlow, fontSize: 13, fontWeight: '500' }}>
                      시스템 설정에서 위치 허용
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            )}
          </ProfileSection>
        ) : null}

        <ProfileSection title="내 명소" theme={theme}>
          <ProfileMySpotsCard
            activityRevision={spotActivityRevision}
            onOpenSpotDetail={onOpenSpotDetail}
          />
        </ProfileSection>

        <ProfileSection title="앱 설정" theme={theme}>
          <GlassCard padding={8}>
            <SettingRow
              theme={theme}
              icon="eye"
              title="Night Vision 모드"
              subtitle="어두운 환경에 최적화"
              toggle
              value={isRedMode}
              onToggle={() => onToggleRedMode()}
            />
            <SettingRow
              theme={theme}
              icon="camera"
              title="촬영 가이드"
              subtitle="별·야경·유성우 촬영 팁"
              chevron
              onPress={() => setPhotographyGuideOpen(true)}
            />
          </GlassCard>
        </ProfileSection>

        <ProfileSection title="앱 정보" theme={theme}>
          <ProfileAppInfoCard />
        </ProfileSection>

        <ProfileSection title="계정" theme={theme}>
          <GlassCard padding={8}>
            <SettingRow
              theme={theme}
              icon="shield"
              title="회원 탈퇴"
              subtitle="계정과 데이터가 삭제됩니다"
              chevron
              danger
              dangerMuted
              isRedMode={isRedMode}
              onPress={() => setDeleteOpen(true)}
            />
          </GlassCard>
        </ProfileSection>

        <ProfileSection theme={theme}>
          <GlassCard padding={4}>
            <SettingRow
              theme={theme}
              icon="log-out"
              title="로그아웃"
              chevron
              onPress={() => setLogoutConfirmOpen(true)}
            />
          </GlassCard>
        </ProfileSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
            StarChaser v1.0.0
          </Text>
          <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
            © 2026 StarChaser
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={spotPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpotPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSpotPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, glassCardStyle(theme)]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              Star-Index 알림 기준 명소
            </Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => {
                  setSpotPickerOpen(false);
                  if (!prefs) return;
                  void persistPrefs({ ...prefs, alertSpotId: null });
                }}
                style={({ pressed }) => [
                  styles.modalRow,
                  { backgroundColor: pressed ? theme.inputBackground : 'transparent' },
                ]}
              >
                <Text style={{ color: theme.foreground }}>선택 안 함</Text>
              </Pressable>
              {sortedSpots.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSpotPickerOpen(false);
                    if (!prefs) return;
                    void persistPrefs({ ...prefs, alertSpotId: s.id });
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    { backgroundColor: pressed ? theme.inputBackground : 'transparent' },
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
          completeAccountDeletion();
        }}
      />

      <AppAlertModal
        visible={logoutConfirmOpen}
        tone="danger"
        title="로그아웃"
        message="로그아웃하시겠습니까?"
        primaryLabel="로그아웃"
        secondaryLabel="취소"
        onPrimary={() => {
          setLogoutConfirmOpen(false);
          void onLogout();
        }}
        onSecondary={() => setLogoutConfirmOpen(false)}
        onRequestClose={() => setLogoutConfirmOpen(false)}
      />
    </>
  );
}

function SettingRow({
  theme,
  icon,
  title,
  subtitle,
  toggle,
  value,
  disabled,
  onToggle,
  chevron,
  trailingText,
  danger = false,
  dangerMuted = false,
  isRedMode = false,
  onPress,
}: {
  theme: ThemeTokens;
  icon: ProfileSettingIconName;
  title: string;
  subtitle?: string;
  toggle?: boolean;
  value?: boolean;
  disabled?: boolean;
  onToggle?: (v: boolean) => void;
  chevron?: boolean;
  trailingText?: string;
  danger?: boolean;
  /** danger일 때 제목·아이콘을 subtitle 톤(연한 빨강)으로 맞춤 */
  dangerMuted?: boolean;
  isRedMode?: boolean;
  onPress?: () => void;
}) {
  const accent = danger ? dangerAccent(theme, isRedMode) : null;
  const mutedDanger = danger && dangerMuted && accent;
  const titleColor = mutedDanger ? accent.subtitle : (accent?.title ?? theme.foreground);
  const iconColor = mutedDanger ? accent.subtitle : (accent?.icon ?? theme.primaryGlow);
  const chevronColor = mutedDanger ? accent.subtitle : (accent?.icon ?? theme.mutedForeground);
  const inner = (
    <>
      <View
        style={[
          styles.iconCircle,
          danger && accent
            ? { backgroundColor: accent.iconBg, borderColor: accent.iconBorder }
            : { backgroundColor: theme.primaryGlowMuted, borderColor: theme.primaryGlowBorder },
        ]}
      >
        <ProfileSettingIcon
          name={icon}
          color={iconColor}
          size={16}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.rowSub,
              { color: accent?.subtitle ?? theme.mutedForeground },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {toggle && value !== undefined && onToggle ? (
        <AppToggle value={value} onValueChange={onToggle} disabled={disabled} />
      ) : trailingText ? (
        <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>{trailingText}</Text>
      ) : chevron ? (
        <ProfileSettingIcon
          name="chevron-right"
          color={chevronColor}
          size={18}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.88 : 1 }]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.row}>{inner}</View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },
  passwordSuccess: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  profileActionsCard: {
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1 },
  profileName: { ...typography.h2, marginBottom: 4 },
  profileEmail: typography.bodySm,
  errBanner: { fontSize: 13, marginBottom: spacing.md },
  nested: { marginLeft: spacing.md, marginTop: 4 },
  spotPickBlock: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 8 },
  spotPickLabel: { fontSize: 12 },
  spotPickBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryWrap: { padding: spacing.lg, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  footer: { alignItems: 'center', marginTop: spacing.xl, gap: 4 },
  footerText: { fontSize: 11 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalSheet: { padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { ...typography.h3, marginBottom: spacing.md },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
  },
});

import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiRequestError,
  authorizedGetJson,
  authorizedPutJson,
  SessionExpiredError,
} from '../../lib/api-client';
import {
  DEFAULT_STAR_INDEX_ALERT_THRESHOLD,
  normalizeStarIndexAlertThreshold,
  STAR_INDEX_ALERT_THRESHOLDS,
  type StarIndexAlertThreshold,
} from '../../lib/star-index-alert-threshold';
import { LOCATION_ALERT_THRESHOLD_HINT } from '../../lib/notification-copy';
import type { NotificationPreferenceDto } from '../../lib/types/api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { AppToggle } from '../ui';

/**
 * MAIN — 위치한 곳 Star-Index 알림 (GPS·역지오 기준 UX).
 * preferences.locationStarIndexAlertEnabled · starIndexAlertThreshold 사용.
 * TODO(BE): 위치한 곳 스케줄 푸시 발송 로직 (ME alertSpotId 채널과 별도).
 */

interface MainStarIndexAlertSheetProps {
  visible: boolean;
  onClose: () => void;
  onSessionInvalidated: () => void | Promise<void>;
}

export function MainStarIndexAlertSheet({
  visible,
  onClose,
  onSessionInvalidated,
}: MainStarIndexAlertSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferenceDto | null>(null);
  const [selectedThreshold, setSelectedThreshold] = useState<StarIndexAlertThreshold>(
    DEFAULT_STAR_INDEX_ALERT_THRESHOLD,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authorizedGetJson<NotificationPreferenceDto>(
        '/notifications/preferences',
      );
      const threshold = normalizeStarIndexAlertThreshold(data.starIndexAlertThreshold);
      setPrefs({ ...data, starIndexAlertThreshold: threshold });
      setSelectedThreshold(threshold);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setError(e instanceof ApiRequestError ? e.message : '설정을 불러오지 못했습니다.');
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, [onSessionInvalidated]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const persist = useCallback(
    async (next: NotificationPreferenceDto) => {
      setSaving(true);
      setError(null);
      try {
        const saved = await authorizedPutJson<NotificationPreferenceDto>(
          '/notifications/preferences',
          {
            alertsEnabled: next.alertsEnabled,
            locationStarIndexAlertEnabled: next.locationStarIndexAlertEnabled,
            starIndexAlertThreshold: next.starIndexAlertThreshold,
          },
        );
        const threshold = normalizeStarIndexAlertThreshold(saved.starIndexAlertThreshold);
        setPrefs({ ...saved, starIndexAlertThreshold: threshold });
        setSelectedThreshold(threshold);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        setError(e instanceof ApiRequestError ? e.message : '저장에 실패했습니다.');
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load, onSessionInvalidated],
  );

  const enabled = Boolean(
    prefs?.locationStarIndexAlertEnabled && prefs?.alertsEnabled,
  );

  const selectThreshold = (t: StarIndexAlertThreshold) => {
    if (!prefs || saving || selectedThreshold === t) return;
    setSelectedThreshold(t);
    void persist({
      ...prefs,
      starIndexAlertThreshold: t,
    });
  };

  const toggleEnabled = (on: boolean) => {
    if (!prefs || saving) return;
    void persist({
      ...prefs,
      alertsEnabled: on ? true : prefs.alertsEnabled,
      locationStarIndexAlertEnabled: on,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View
          style={[
            styles.sheet,
            glassCardStyle(theme),
            { marginTop: Math.max(insets.top, 12) + 48 },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="bell" size={18} color={theme.primaryGlow} />
              <Text style={[styles.title, { color: theme.foreground }]}>
                위치한 곳 알림
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.lead, { color: theme.mutedForeground }]}>
            위치한 곳 Star-Index가 선택한 점수 이상이면 하루 1회 푸시로 알려 드려요.
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                알림 기준 점수
              </Text>

              <View style={styles.thresholdList}>
                {STAR_INDEX_ALERT_THRESHOLDS.map((t) => (
                  <ThresholdOption
                    key={t}
                    theme={theme}
                    value={t}
                    selected={selectedThreshold === t}
                    disabled={saving}
                    onPress={() => selectThreshold(t)}
                  />
                ))}
              </View>

              <Text style={[styles.thresholdHint, { color: theme.mutedForeground }]}>
                {LOCATION_ALERT_THRESHOLD_HINT}
              </Text>

              <View style={[styles.toggleRow, { borderTopColor: theme.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: theme.foreground }]}>
                    알림 받기
                  </Text>
                  <Text style={[styles.toggleSub, { color: theme.mutedForeground }]}>
                    {enabled
                      ? `${selectedThreshold}점 이상일 때 하루 1회 발송`
                      : `${selectedThreshold}점 기준 · 아래 스위치로 켜고 끌 수 있어요`}
                  </Text>
                </View>
                <AppToggle
                  value={enabled}
                  onValueChange={toggleEnabled}
                  disabled={saving || !prefs}
                />
              </View>

              {error ? (
                <Text style={[styles.err, { color: theme.destructive }]}>{error}</Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ThresholdOption({
  theme,
  value,
  selected,
  disabled,
  onPress,
}: {
  theme: ThemeTokens;
  value: StarIndexAlertThreshold;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={null}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${value}점 이상`}
      style={({ pressed }) => [
        styles.thresholdOption,
        {
          borderColor: selected ? theme.primaryGlow : theme.borderSubtle,
          backgroundColor: selected
            ? theme.primaryGlowMuted
            : pressed
              ? theme.inputBackground
              : 'rgba(0,0,0,0.25)',
        },
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected ? theme.primaryGlow : theme.mutedForeground,
          },
        ]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: theme.primaryGlow }]} />
        ) : null}
      </View>
      <Text
        style={[
          styles.thresholdOptionLabel,
          { color: selected ? theme.foreground : theme.mutedForeground },
        ]}
      >
        {value}점 이상
      </Text>
      {selected ? (
        <Text style={[styles.thresholdOptionBadge, { color: theme.primaryGlow }]}>
          선택됨
        </Text>
      ) : (
        <View style={styles.thresholdOptionSpacer} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '600' },
  lead: { fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  thresholdList: { gap: 8, marginBottom: spacing.sm },
  thresholdOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  thresholdOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  thresholdOptionBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  thresholdOptionSpacer: { width: 36 },
  thresholdHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  toggleTitle: { fontSize: 15, fontWeight: '500' },
  toggleSub: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  err: { fontSize: 12, marginTop: spacing.sm },
});

/**
 * 명소 제보 — GPS + 텍스트를 관리자에게 전송
 */

import * as Location from 'expo-location';
import React, { useCallback, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiRequestError,
  SessionExpiredError,
  submitSpotReport,
} from '../../lib/api-client';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';

interface SpotReportSectionProps {
  observerLat?: number | null;
  observerLng?: number | null;
  useDeviceLocation?: boolean;
  onSessionInvalidated: () => Promise<void>;
}

async function resolveGps(
  observerLat: number | null | undefined,
  observerLng: number | null | undefined,
  useDeviceLocation: boolean,
): Promise<{ lat: number; lng: number } | null> {
  if (useDeviceLocation && Platform.OS !== 'web') {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === Location.PermissionStatus.GRANTED) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      /* 폴백 */
    }
  }

  if (
    observerLat != null &&
    observerLng != null &&
    Number.isFinite(observerLat) &&
    Number.isFinite(observerLng)
  ) {
    return { lat: observerLat, lng: observerLng };
  }

  return null;
}

export function SpotReportSection({
  observerLat = null,
  observerLng = null,
  useDeviceLocation = true,
  onSessionInvalidated,
}: SpotReportSectionProps) {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('명소 설명을 입력해 주세요.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const coords = await resolveGps(observerLat, observerLng, useDeviceLocation);
      if (!coords) {
        setError('위치 권한을 허용하거나 GPS를 켜 주세요.');
        return;
      }

      await submitSpotReport({
        message: trimmed,
        lat: coords.lat,
        lng: coords.lng,
      });

      setMessage('');
      setSuccess('제보를 보냈습니다.');
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setError(
        e instanceof ApiRequestError ? e.message : '명소 제보에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [message, observerLat, observerLng, onSessionInvalidated, useDeviceLocation]);

  return (
    <Card
      title="명소 제보"
      description="목록에 없는 관측지를 알려 주세요. 현재 GPS와 Star-Index가 함께 전달됩니다."
    >
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.foreground }]}>명소 설명</Text>
        <TextInput
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            setError(null);
            setSuccess(null);
          }}
          placeholder="예: 주차 가능한 언덕, 동쪽 하늘이 잘 보여요"
          placeholderTextColor={theme.mutedForeground}
          multiline
          textAlignVertical="top"
          maxLength={500}
          editable={!busy}
          style={[
            styles.input,
            {
              color: theme.foreground,
              backgroundColor: theme.inputBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        />
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          {message.length}/500
        </Text>
      </View>

      {error ? (
        <Text style={[styles.feedback, { color: theme.destructive }]}>{error}</Text>
      ) : null}
      {success && !busy ? (
        <Text style={[styles.feedback, { color: theme.primaryGlow }]}>{success}</Text>
      ) : null}

      <Button
        label="명소 제보 보내기"
        fullWidth
        loading={busy}
        disabled={busy}
        onPress={() => void submit()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: { fontSize: 11, textAlign: 'right' },
  feedback: { fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
});

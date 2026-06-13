/**
 * 명소 제보 — 일기와 동일한 관측 위치 선택(현재 위치/명소 검색/직접 입력) + 설명을 관리자에게 전송
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useState } from 'react';
import {
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
import { fetchSpotById } from '../../lib/spots-api';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';
import { GlassCard } from '../ui/GlassCard';
import { DiarySectionHeader } from './DiarySectionHeader';
import {
  DiaryLocationField,
  type DiaryLocationValue,
} from './DiaryLocationField';

interface SpotReportSectionProps {
  observerLat?: number | null;
  observerLng?: number | null;
  placeLabel?: string | null;
  onSessionInvalidated: () => Promise<void>;
}

function hasCoords(lat?: number | null, lng?: number | null): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

function initialLocation(placeLabel?: string | null): DiaryLocationValue {
  return {
    mode: 'current',
    spotId: null,
    label: placeLabel?.trim() || '현재 위치',
  };
}

/** 선택한 위치를 제보용 좌표·라벨로 변환. GPS 없이도 명소·직접 입력으로 제보 가능 */
async function resolveReportLocation(
  location: DiaryLocationValue,
  observerLat: number | null | undefined,
  observerLng: number | null | undefined,
): Promise<{ lat: number; lng: number; label: string } | null> {
  if (location.mode === 'custom') {
    if (hasCoords(location.customLat, location.customLng)) {
      return {
        lat: location.customLat as number,
        lng: location.customLng as number,
        label: location.label,
      };
    }
    return null;
  }

  if (location.mode === 'spot' && location.spotId) {
    const spot = await fetchSpotById(location.spotId);
    return {
      lat: spot.lat,
      lng: spot.lng,
      label: location.spotFullName || location.label,
    };
  }

  // 현재 위치 — GPS 좌표가 있을 때만
  if (hasCoords(observerLat, observerLng)) {
    return {
      lat: observerLat as number,
      lng: observerLng as number,
      label: location.label?.trim() || '현재 위치',
    };
  }

  return null;
}

export function SpotReportSection({
  observerLat = null,
  observerLng = null,
  placeLabel = null,
  onSessionInvalidated,
}: SpotReportSectionProps) {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<DiaryLocationValue>(() =>
    initialLocation(placeLabel),
  );
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
      const resolved = await resolveReportLocation(
        location,
        observerLat,
        observerLng,
      );
      if (!resolved) {
        setError(
          '관측 위치를 선택해 주세요. 현재 위치 좌표가 없으면 명소 검색이나 직접 입력으로 위치를 골라 주세요.',
        );
        return;
      }

      await submitSpotReport({
        message: trimmed,
        lat: resolved.lat,
        lng: resolved.lng,
        placeLabel: resolved.label?.trim() || undefined,
      });

      setMessage('');
      setLocation(initialLocation(placeLabel));
      setSuccess('제보를 보냈습니다. 검토 후 명소 목록에 반영될 수 있어요.');
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
  }, [message, location, observerLat, observerLng, placeLabel, onSessionInvalidated]);

  return (
    <GlassCard glow>
      <DiarySectionHeader
        icon="map-pin"
        title="명소 제보"
        subtitle="목록에 없는 관측지를 알려 주세요. 선택한 위치와 Star-Index가 함께 전달됩니다."
      />

      <View style={styles.field}>
        <DiaryLocationField
          value={location}
          onChange={(next) => {
            setLocation(next);
            setError(null);
            setSuccess(null);
          }}
          observerLat={observerLat}
          observerLng={observerLng}
          placeLabel={placeLabel}
          disabled={busy}
          fieldLabel="제보 위치"
          pickerTitle="제보 위치 선택"
          onSessionInvalidated={onSessionInvalidated}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.foreground }]}>명소 설명</Text>
        <TextInput
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            setError(null);
            setSuccess(null);
          }}
          placeholder="예: 저만 알고 있던 숨겨진 명소에요. 뒷산인데 별이 잘 보여서 제보 드립니다."
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

      <View
        style={[
          styles.tipRow,
          {
            backgroundColor: theme.primaryGlowMuted,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Feather name="info" size={14} color={theme.primaryGlow} />
        <Text style={[styles.tipText, { color: theme.mutedForeground }]}>
          제보하신 위치는 관리자 검토 후 지도 명소로 등록될 수 있어요.
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
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 128,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: { fontSize: 11, textAlign: 'right' },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  feedback: { fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
});

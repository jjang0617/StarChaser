/**
 * 일기 작성 모달 — 제목 · 사진 · 본문 · 저장
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { AppPressable } from '../ui/AppPressable';
import { Button, Input } from '../ui';
import {
  ApiRequestError,
  createObservation,
  SessionExpiredError,
  uploadObservationPhoto,
} from '../../lib/api-client';
import { weatherSnapshotForManualDiaryScore } from '../../lib/diary-manual-weather-snapshot';
import {
  DiaryLocationField,
  type DiaryLocationValue,
} from './DiaryLocationField';
import { DiaryPhotoPicker, type LocalDiaryPhoto } from './DiaryPhotoPicker';
import { observationPlaceLabelForSave } from '../../lib/observation-place-label';
import type { ObservationResult } from './ObservationResultPicker';

interface DiaryWriteModalProps {
  visible: boolean;
  result: ObservationResult;
  observerLat?: number | null;
  observerLng?: number | null;
  placeLabel?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onSessionInvalidated: () => Promise<void>;
}

function initialLocationValue(placeLabel: string | null | undefined): DiaryLocationValue {
  return {
    mode: 'current',
    spotId: null,
    label: placeLabel?.trim() || '관측 위치',
  };
}

function resolveSaveSpotId(location: DiaryLocationValue): string | undefined {
  if (location.mode === 'spot' && location.spotId) {
    return location.spotId;
  }
  return undefined;
}

function parseManualScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
    return null;
  }
  return n;
}

export function DiaryWriteModal({
  visible,
  result,
  observerLat,
  observerLng,
  placeLabel,
  onClose,
  onSaved,
  onSessionInvalidated,
}: DiaryWriteModalProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [starIndexScore, setStarIndexScore] = useState('');
  const [photos, setPhotos] = useState<LocalDiaryPhoto[]>([]);
  const [location, setLocation] = useState<DiaryLocationValue>(() =>
    initialLocationValue(placeLabel),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setContent('');
    setStarIndexScore('');
    setPhotos([]);
    setError(null);
    setLocation(initialLocationValue(placeLabel));
  }, [visible, placeLabel]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [error]);

  const save = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (!trimmedContent) {
      setError('내용을 입력해 주세요.');
      return;
    }
    const score = parseManualScore(starIndexScore);
    if (score == null) {
      setError('Star-Index 점수를 0~100 사이 정수로 입력해 주세요.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saveSpotId = resolveSaveSpotId(location);
      const created = await createObservation({
        spotId: saveSpotId,
        starIndexVal: score,
        weatherSnapshot: weatherSnapshotForManualDiaryScore(
          score,
        ) as unknown as Record<string, unknown>,
        result,
        title: trimmedTitle,
        content: trimmedContent,
        placeLabel: observationPlaceLabelForSave({
          mode: location.mode,
          label: location.label,
          spotFullName: location.spotFullName,
        }),
      });

      for (const photo of photos) {
        await uploadObservationPhoto(created.id, photo.uri, photo.mimeType);
      }

      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setError(
        e instanceof ApiRequestError ? e.message : '일기 저장에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    content,
    onClose,
    onSaved,
    onSessionInvalidated,
    location,
    photos,
    result,
    starIndexScore,
    title,
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <AppPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
          <View
            style={[styles.sheet, { backgroundColor: theme.deepNavy, borderColor: theme.border }]}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <Text style={[styles.title, { color: theme.foreground }]}>오늘의 일기</Text>

            <ScrollView
              ref={scrollRef}
              style={[styles.scroll, { backgroundColor: theme.deepNavy }]}
              contentContainerStyle={styles.scrollInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Input
                label="제목"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (error) setError(null);
                }}
                placeholder="오늘 밤하늘은 어땠나요?"
                maxLength={120}
              />

              <Input
                label="Star-Index 점수"
                value={starIndexScore}
                onChangeText={(text) => {
                  setStarIndexScore(text.replace(/[^0-9]/g, ''));
                  if (error) setError(null);
                }}
                placeholder="0 ~ 100"
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={[styles.scoreHint, { color: theme.mutedForeground }]}>
                그날 밤 느낀 점수를 직접 입력해 주세요.
              </Text>

              <DiaryPhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />

              <DiaryLocationField
                value={location}
                onChange={setLocation}
                observerLat={observerLat}
                observerLng={observerLng}
                placeLabel={placeLabel}
                disabled={busy}
                onSessionInvalidated={onSessionInvalidated}
              />

              <View style={styles.contentWrap}>
                <Text style={[styles.contentLabel, { color: theme.foreground }]}>내용</Text>
                <TextInput
                  value={content}
                  onChangeText={(text) => {
                    setContent(text);
                    if (error) setError(null);
                  }}
                  placeholder="별 관측 이야기를 자유롭게 적어 보세요"
                  placeholderTextColor={theme.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  maxLength={5000}
                  style={[
                    styles.contentInput,
                    {
                      color: theme.foreground,
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                />
              </View>

              {error ? (
                <Text style={[styles.err, { color: theme.destructive }]}>{error}</Text>
              ) : null}

              {busy ? (
                <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 8 }} />
              ) : null}
            </ScrollView>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <Button label="취소" variant="outline" fullWidth disabled={busy} onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="저장"
                  fullWidth
                  loading={busy}
                  disabled={busy}
                  onPress={() => void save()}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    overflow: 'hidden',
    zIndex: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scroll: { maxHeight: 420 },
  scrollInner: { gap: spacing.md, paddingBottom: spacing.sm },
  scoreHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
  },
  contentWrap: { gap: spacing.sm },
  contentLabel: { fontSize: 13, fontWeight: '500' },
  contentInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  err: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
});

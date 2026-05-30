/**
 * 일기 작성 모달 — 제목 · 사진 · 본문 · 저장
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Input } from '../ui';
import {
  ApiRequestError,
  createObservation,
  SessionExpiredError,
  uploadObservationPhoto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { DiaryPhotoPicker, type LocalDiaryPhoto } from './DiaryPhotoPicker';
import type { ObservationResult } from './ObservationResultPicker';

interface DiaryWriteModalProps {
  visible: boolean;
  result: ObservationResult;
  starIndexData: StarIndexResponseDto;
  spotId?: string;
  onClose: () => void;
  onSaved: () => void;
  onSessionInvalidated: () => Promise<void>;
}

export function DiaryWriteModal({
  visible,
  result,
  starIndexData,
  spotId,
  onClose,
  onSaved,
  onSessionInvalidated,
}: DiaryWriteModalProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<LocalDiaryPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setContent('');
    setPhotos([]);
    setError(null);
  }, [visible]);

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

    setBusy(true);
    setError(null);
    try {
      const created = await createObservation({
        spotId,
        starIndexVal: starIndexData.score,
        weatherSnapshot: starIndexData.weatherSnapshot as unknown as Record<string, unknown>,
        result,
        title: trimmedTitle,
        content: trimmedContent,
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
    photos,
    result,
    spotId,
    starIndexData,
    title,
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
          <View
            style={[styles.sheet, { backgroundColor: theme.deepNavy, borderColor: theme.border }]}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <Text style={[styles.title, { color: theme.foreground }]}>오늘의 일기</Text>

            <ScrollView
              style={[styles.scroll, { backgroundColor: theme.deepNavy }]}
              contentContainerStyle={styles.scrollInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Input
                label="제목"
                value={title}
                onChangeText={setTitle}
                placeholder="오늘 밤하늘은 어땠나요?"
                maxLength={120}
              />

              <DiaryPhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />

              <View style={styles.contentWrap}>
                <Text style={[styles.contentLabel, { color: theme.foreground }]}>내용</Text>
                <TextInput
                  value={content}
                  onChangeText={setContent}
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
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  scroll: { maxHeight: 420 },
  scrollInner: { gap: spacing.md, paddingBottom: spacing.sm },
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

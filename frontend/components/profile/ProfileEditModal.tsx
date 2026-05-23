import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../themes/ThemeContext';
import {
  ApiRequestError,
  checkNickname,
  deleteMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
} from '../../lib/api-client';
import type { UserProfileDto } from '../../lib/types/api';
import { Button, Input } from '../ui';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileEditModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: UserProfileDto;
  onClose: () => void;
  onSaved: (next: UserProfileDto) => void;
}) {
  const { theme } = useTheme();
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UserProfileDto>(profile);

  useEffect(() => {
    if (!visible) return;
    setNickname(profile.nickname ?? '');
    setPreview(profile);
    setNicknameError(null);
    setError(null);
  }, [visible, profile]);

  const validateNickname = useCallback(async (value: string): Promise<boolean> => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setNicknameError('닉네임은 2자 이상이어야 합니다');
      return false;
    }
    if (trimmed.length > 30) {
      setNicknameError('닉네임은 30자 이하여야 합니다');
      return false;
    }
    if (trimmed === (profile.nickname ?? '').trim()) {
      setNicknameError(null);
      return true;
    }
    try {
      const { available } = await checkNickname(trimmed);
      if (!available) {
        setNicknameError('이미 사용 중인 닉네임입니다');
        return false;
      }
      setNicknameError(null);
      return true;
    } catch (e) {
      setNicknameError(
        e instanceof ApiRequestError ? e.message : '닉네임 확인에 실패했습니다',
      );
      return false;
    }
  }, [profile.nickname]);

  const pickImage = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    setBusy(true);
    try {
      const updated = await uploadMyAvatar(asset.uri, mime);
      setPreview(updated);
      onSaved(updated);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : '사진 업로드에 실패했습니다',
      );
    } finally {
      setBusy(false);
    }
  }, [onSaved]);

  const removePhoto = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await deleteMyAvatar();
      setPreview(updated);
      onSaved(updated);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : '사진 삭제에 실패했습니다',
      );
    } finally {
      setBusy(false);
    }
  }, [onSaved]);

  const saveNickname = useCallback(async () => {
    setError(null);
    const ok = await validateNickname(nickname);
    if (!ok) return;

    const trimmed = nickname.trim();
    if (trimmed === (profile.nickname ?? '').trim()) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      const updated = await updateMyProfile({ nickname: trimmed });
      setPreview(updated);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : '프로필 저장에 실패했습니다',
      );
    } finally {
      setBusy(false);
    }
  }, [nickname, onClose, onSaved, profile.nickname, validateNickname]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.foreground }]}>프로필 수정</Text>

          <View style={styles.avatarRow}>
            <ProfileAvatar
              nickname={preview.nickname}
              avatarUrl={preview.avatarUrl}
              size={80}
            />
            <View style={styles.avatarActions}>
              <Button
                label="사진 변경"
                variant="outline"
                size="sm"
                disabled={busy}
                onPress={() => void pickImage()}
              />
              {preview.avatarUrl ? (
                <Button
                  label="사진 삭제"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onPress={() => void removePhoto()}
                />
              ) : null}
            </View>
          </View>

          <Input
            label="닉네임"
            monoLabel
            value={nickname}
            onChangeText={(text) => {
              setNickname(text);
              setNicknameError(null);
            }}
            onBlur={() => void validateNickname(nickname)}
            autoCapitalize="none"
            maxLength={30}
            placeholder="2~30자"
            errorMessage={nicknameError ?? undefined}
          />

          <Text style={[styles.emailHint, { color: theme.mutedForeground }]}>
            이메일: {profile.email} (변경 불가)
          </Text>

          {error ? (
            <Text style={[styles.err, { color: theme.destructive }]}>{error}</Text>
          ) : null}

          {busy ? (
            <ActivityIndicator color={theme.starGold} style={{ marginVertical: 8 }} />
          ) : null}

          <View style={styles.btnRow}>
            <View style={{ flex: 1 }}>
              <Button label="취소" variant="outline" fullWidth disabled={busy} onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="저장"
                fullWidth
                disabled={busy}
                onPress={() => void saveNickname()}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  title: { fontSize: 16, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarActions: { flex: 1, gap: 8 },
  emailHint: { fontSize: 11 },
  err: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10 },
});

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { dangerAccent } from '../../themes/themes';
import { ApiRequestError, deleteMyAccount } from '../../lib/api-client';
import { Button, Input } from '../ui';

export function ProfileDeleteAccountModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { theme, isRedMode } = useTheme();
  const danger = dangerAccent(theme, isRedMode);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = useCallback(() => {
    setPassword('');
    setPasswordError(null);
    setFormError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleDelete = useCallback(async () => {
    setFormError(null);
    if (!password) {
      setPasswordError('비밀번호를 입력해 주세요.');
      return;
    }
    setPasswordError(null);

    setBusy(true);
    try {
      await deleteMyAccount(password);
      resetForm();
      onDeleted();
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError ? e.message : '회원 탈퇴에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [onDeleted, password, resetForm]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: danger.title }]}>회원 탈퇴</Text>
          <Text style={[styles.warning, { color: danger.subtitle }]}>
            탈퇴하면 프로필·관측 기록·알림 설정 등 모든 데이터가 삭제되며 복구할 수 없습니다.
          </Text>

          <Input
            label="비밀번호 확인"
            monoLabel
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError(null);
              setFormError(null);
            }}
            secureTextEntry
            placeholder="현재 비밀번호"
            errorMessage={passwordError ?? undefined}
          />

          {formError ? (
            <Text style={[styles.err, { color: theme.destructive }]}>{formError}</Text>
          ) : null}

          {busy ? (
            <ActivityIndicator color={theme.starGold} style={{ marginVertical: 8 }} />
          ) : null}

          <View style={styles.btnRow}>
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="outline"
                fullWidth
                disabled={busy}
                onPress={handleClose}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="탈퇴하기"
                variant="red"
                fullWidth
                disabled={busy}
                onPress={() => void handleDelete()}
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
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '700' },
  warning: { fontSize: 12, lineHeight: 18 },
  err: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10 },
});

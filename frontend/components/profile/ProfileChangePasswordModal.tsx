import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { ApiRequestError, changeMyPassword } from '../../lib/api-client';
import { Button, Input } from '../ui';

function passwordValidationError(password: string): string | null {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  return null;
}

export function ProfileChangePasswordModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);
    setFormError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback((): boolean => {
    const curErr = !currentPassword ? '현재 비밀번호를 입력해 주세요.' : null;
    const newErr = passwordValidationError(newPassword);
    let confErr: string | null = null;
    if (!confirmPassword) {
      confErr = '비밀번호 확인을 입력해 주세요.';
    } else if (newPassword !== confirmPassword) {
      confErr = '비밀번호가 일치하지 않습니다';
    }
    setCurrentError(curErr);
    setNewError(newErr);
    setConfirmError(confErr);
    return !curErr && !newErr && !confErr;
  }, [confirmPassword, currentPassword, newPassword]);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const { message } = await changeMyPassword(currentPassword, newPassword);
      resetForm();
      onSuccess(message);
      onClose();
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError ? e.message : '비밀번호 변경에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    currentPassword,
    newPassword,
    onClose,
    onSuccess,
    resetForm,
    validate,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: theme.foreground }]}>비밀번호 변경</Text>

            <Input
              label="현재 비밀번호"
              monoLabel
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setCurrentError(null);
                setFormError(null);
              }}
              secureTextEntry
              placeholder="현재 비밀번호"
              errorMessage={currentError ?? undefined}
            />
            <Input
              label="새 비밀번호"
              monoLabel
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setNewError(null);
                setFormError(null);
              }}
              onBlur={() => setNewError(passwordValidationError(newPassword))}
              secureTextEntry
              placeholder="6자 이상"
              errorMessage={newError ?? undefined}
            />
            <Input
              label="새 비밀번호 확인"
              monoLabel
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmError(null);
                setFormError(null);
              }}
              onBlur={() => {
                if (!confirmPassword) {
                  setConfirmError(null);
                  return;
                }
                setConfirmError(
                  newPassword === confirmPassword
                    ? null
                    : '비밀번호가 일치하지 않습니다',
                );
              }}
              secureTextEntry
              placeholder="비밀번호 재입력"
              errorMessage={confirmError ?? undefined}
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
                  label="변경하기"
                  fullWidth
                  disabled={busy}
                  onPress={() => void handleSubmit()}
                />
              </View>
            </View>
          </ScrollView>
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
    maxHeight: '85%',
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  err: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});

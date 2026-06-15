/**
 * 카카오 로그인/회원가입 전용 버튼 (카카오 브랜드 가이드 준수)
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';

interface KakaoSubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  label?: string;
}

export function KakaoSubmitButton({
  loading = false,
  disabled = false,
  onPress,
  label = '카카오 로그인',
}: KakaoSubmitButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? '#E6CF00' : '#FEE500',
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#191919" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>💬</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 14,
    color: '#191919',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#191919',
    letterSpacing: 0.1,
  },
});

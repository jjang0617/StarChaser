/**
 * StarChaser — Input
 * Anti-AI: focus 시 border 색상 변화만 (shadow 없음)
 * monoLabel: 라벨을 Space Mono로 (계측 장비 느낌)
 */

import React, { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

interface InputProps extends TextInputProps {
  label?:        string;
  hint?:         string;
  errorMessage?: string;
  icon?:         ReactNode;
  required?:     boolean;
  monoLabel?:    boolean;   // 라벨 Space Mono
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  hint,
  errorMessage,
  icon,
  required    = false,
  monoLabel   = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  // border 상태 — shadow 없이 색상 변화만
  const borderColor =
    hasError ? theme.destructive :
    focused  ? theme.ring        :
               theme.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* 라벨 */}
      {label && (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              {
                color:      theme.foreground,
                fontFamily: monoLabel ? 'SpaceMono-Regular' : undefined,
                fontSize:   monoLabel ? 10 : 13,
                letterSpacing: monoLabel ? 0.8 : 0,
              },
            ]}
          >
            {label}
          </Text>
          {required && (
            <Text style={[styles.required, { color: theme.starGold }]}>
              REQUIRED
            </Text>
          )}
        </View>
      )}

      {/* 인풋 — border 변화만, shadow 없음 */}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.input,
            borderColor,
            borderRadius:    theme.radius,
          },
        ]}
      >
        {icon && (
          <Text style={[styles.icon, { color: theme.mutedForeground }]}>
            {icon}
          </Text>
        )}
        <TextInput
          placeholderTextColor={theme.mutedForeground}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e  => { setFocused(false); onBlur?.(e); }}
          style={[
            styles.input,
            {
              color:      theme.foreground,
              fontFamily: undefined,
              fontSize:   13,
            },
          ]}
          {...rest}
        />
      </View>

      {/* 에러 메시지 */}
      {hasError && (
        <Text style={[styles.errorMsg, { color: theme.dimRedFg, fontFamily: 'SpaceMono-Regular' }]}>
          ⚠ {errorMessage}
        </Text>
      )}

      {/* 힌트 */}
      {hint && !hasError && (
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            5,
  },
  label: {
    fontWeight: '500',
  },
  required: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       9,
    letterSpacing:  0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    borderWidth:    1,
    paddingHorizontal: 10,
    gap:            7,
    // ⚠️ elevation/shadow 없음
  },
  icon: {
    fontSize:    14,
    lineHeight:  20,
    flexShrink:   0,
  },
  input: {
    flex:          1,
    paddingVertical: 9,
  },
  errorMsg: {
    fontSize:      10,
    letterSpacing:  0.3,
  },
  hint: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       9,
    letterSpacing:  0.3,
  },
});

/**
 * StarChaser — Input
 * Figma AuthInput: rounded-xl · input-background · card-border focus
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
import { glassInputShellStyle, typography } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface InputProps extends TextInputProps {
  label?:        string;
  hint?:         string;
  errorMessage?: string;
  icon?:         ReactNode;
  required?:     boolean;
  monoLabel?:    boolean;
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

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              typography.label,
              {
                color:      theme.foreground,
                fontFamily: monoLabel ? 'SpaceMono-Regular' : undefined,
                fontSize:   monoLabel ? 10 : typography.label.fontSize,
                letterSpacing: monoLabel ? 0.8 : 0,
              },
            ]}
          >
            {label}
          </Text>
          {required && (
            <Text style={[styles.required, { color: theme.primaryGlow }]}>
              REQUIRED
            </Text>
          )}
        </View>
      )}

      <View style={[styles.inputWrap, glassInputShellStyle(theme, focused, hasError)]}>
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
            typography.body,
            { color: theme.foreground, fontSize: 14 },
          ]}
          {...rest}
        />
      </View>

      {hasError && (
        <Text style={[styles.errorMsg, { color: theme.destructive }]}>
          {errorMessage}
        </Text>
      )}

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
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            5,
  },
  label: {},
  required: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       9,
    letterSpacing:  0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 14,
    gap:            7,
  },
  icon: {
    fontSize:    14,
    lineHeight:  20,
    flexShrink:   0,
  },
  input: {
    flex:          1,
    paddingVertical: 12,
  },
  errorMsg: {
    fontSize:      12,
    lineHeight:    16,
  },
  hint: {
    fontSize:       12,
    lineHeight:     16,
  },
});

/**
 * 관측 결과 선택 — 성공 / 부분 / 실패 (보더리스 탭 스타일)
 */

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../ui/AppPressable';
import { spacing } from '../../themes/design-tokens';
import type { ThemeTokens } from '../../themes/themes';
import { useTheme } from '../../themes/ThemeContext';

export type ObservationResult = 'success' | 'partial' | 'fail';

const OPTIONS: {
  key: ObservationResult;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'success', label: '성공', icon: 'check' },
  { key: 'partial', label: '부분', icon: 'minus' },
  { key: 'fail', label: '실패', icon: 'x' },
];

function accentFor(key: ObservationResult, theme: ThemeTokens): string {
  if (key === 'success') return theme.primaryGlow;
  if (key === 'partial') return theme.secondary;
  return theme.destructive;
}

interface ObservationResultPickerProps {
  value: ObservationResult;
  onChange: (value: ObservationResult) => void;
}

export function ObservationResultPicker({ value, onChange }: ObservationResultPickerProps) {
  const { theme } = useTheme();
  const activeIndex = OPTIONS.findIndex((o) => o.key === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: theme.mutedForeground }]}>오늘 관측은 어땠나요?</Text>

      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          const accent = accentFor(opt.key, theme);

          return (
            <AppPressable
              key={opt.key}
              onPress={() => onChange(opt.key)}
              style={({ pressed }) => [
                styles.option,
                { opacity: pressed ? 0.82 : 1 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.iconStack}>
                {active ? (
                  <View
                    style={[
                      styles.iconHalo,
                      {
                        backgroundColor:
                          opt.key === 'success'
                            ? theme.primaryGlowMuted
                            : opt.key === 'partial'
                              ? 'rgba(93, 173, 235, 0.14)'
                              : 'rgba(239, 68, 68, 0.12)',
                        shadowColor: accent,
                      },
                    ]}
                  />
                ) : null}
                <Feather
                  name={opt.icon}
                  size={active ? 20 : 18}
                  color={active ? accent : theme.mutedForeground}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: active ? accent : theme.mutedForeground,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {opt.label}
              </Text>
            </AppPressable>
          );
        })}
      </View>

      <View style={[styles.track, { backgroundColor: theme.borderSubtle }]}>
        <View
          style={[
            styles.thumb,
            {
              width: `${100 / OPTIONS.length}%`,
              left: `${(100 / OPTIONS.length) * activeIndex}%`,
              backgroundColor: accentFor(value, theme),
              shadowColor: accentFor(value, theme),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  caption: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  iconStack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    ...(Platform.OS === 'android' ? { elevation: 0 } : { elevation: 2 }),
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.15,
  },
  track: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 2,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
});

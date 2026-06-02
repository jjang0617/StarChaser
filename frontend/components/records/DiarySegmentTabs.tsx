/**
 * DIARY 화면 — 작성 | 펼쳐보기 | 명소 제보 (글래스 필 탭)
 */

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../ui/AppPressable';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

export type DiarySectionKey = 'write' | 'browse' | 'register-spot';

interface DiarySegmentTabsProps {
  active: DiarySectionKey;
  onChange: (key: DiarySectionKey) => void;
}

const SECTIONS: {
  key: DiarySectionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  accessibilityLabel: string;
}[] = [
  { key: 'write', label: '일기 작성', icon: 'edit-3', accessibilityLabel: '일기 작성' },
  { key: 'browse', label: '펼쳐보기', icon: 'book-open', accessibilityLabel: '일기 펼쳐보기' },
  { key: 'register-spot', label: '명소 제보', icon: 'map-pin', accessibilityLabel: '명소 제보하기' },
];

export function DiarySegmentTabs({ active, onChange }: DiarySegmentTabsProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: theme.inputBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      {SECTIONS.map((section) => {
        const isActive = active === section.key;
        return (
          <AppPressable
            key={section.key}
            onPress={() => onChange(section.key)}
            style={({ pressed }) => [
              styles.tab,
              isActive && [
                styles.tabActive,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.primaryGlow,
                  shadowColor: theme.primaryGlow,
                },
                Platform.OS === 'android' && styles.tabActiveAndroid,
              ],
              !isActive && { backgroundColor: 'transparent' },
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={section.accessibilityLabel}
          >
            <Feather
              name={section.icon}
              size={15}
              color={isActive ? theme.primaryGlow : theme.mutedForeground}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? theme.foreground : theme.mutedForeground,
                  fontWeight: isActive ? '600' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {section.label}
            </Text>
          </AppPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 2,
  },
  tabActiveAndroid: {
    elevation: 0,
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.1,
  },
});

/**
 * DIARY 화면 — 작성 | 펼쳐보기 | 명소 등록 (구분선 탭)
 */

import React, { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

export type DiarySectionKey = 'write' | 'browse' | 'register-spot';

interface DiarySegmentTabsProps {
  active: DiarySectionKey;
  onChange: (key: DiarySectionKey) => void;
}

const SECTIONS: { key: DiarySectionKey; label: string; accessibilityLabel: string }[] = [
  { key: 'write', label: '일기 작성', accessibilityLabel: '일기 작성' },
  { key: 'browse', label: '펼쳐보기', accessibilityLabel: '일기 펼쳐보기' },
  { key: 'register-spot', label: '명소 제보', accessibilityLabel: '명소 제보하기' },
];

export function DiarySegmentTabs({ active, onChange }: DiarySegmentTabsProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.bar, { borderBottomColor: theme.cardBorder }]}>
      {SECTIONS.map((section, index) => {
        const isActive = active === section.key;
        return (
          <Fragment key={section.key}>
            {index > 0 ? (
              <Text style={[styles.pipe, { color: theme.cardBorder }]}>|</Text>
            ) : null}
            <Pressable
              onPress={() => onChange(section.key)}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={section.accessibilityLabel}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? theme.primaryGlow : theme.mutedForeground,
                    fontWeight: isActive ? '600' : '500',
                  },
                ]}
                numberOfLines={2}
              >
                {section.label}
              </Text>
              {isActive ? (
                <View
                  style={[
                    styles.activeLine,
                    {
                      backgroundColor: theme.primaryGlow,
                      shadowColor: theme.primaryGlow,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  pipe: {
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '300',
    lineHeight: 16,
    marginHorizontal: 2,
    opacity: 0.75,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  activeLine: {
    position: 'absolute',
    bottom: 0,
    left: '14%',
    right: '14%',
    height: 2,
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 2,
  },
});

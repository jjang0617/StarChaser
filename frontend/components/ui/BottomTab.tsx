/**
 * StarChaser — BottomTab (Figma TabBar)
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { spacing, typography } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { BottomTabIcon, type BottomTabIconName } from './BottomTabIcon';

export interface BottomTabItem {
  key: string;
  label: string;
  icon: BottomTabIconName;
  /** red mode 전용 텍스트 아이콘 */
  redIcon?: string;
}

interface BottomTabProps {
  items: BottomTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

export function BottomTab({ items, activeKey, onChange, style }: BottomTabProps) {
  const { theme, isRedMode } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.deepNavy,
          borderTopColor: theme.cardBorder,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const activeColor = theme.primaryGlow;
        const inactiveColor = theme.mutedForeground;
        const labelColor = isActive ? activeColor : inactiveColor;

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.tabItem,
              isActive && {
                backgroundColor: theme.primaryGlowMuted,
                borderRadius: 12,
              },
              pressed && !isActive && { opacity: 0.75 },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
          >
            <View style={styles.iconWrap}>
              {isRedMode ? (
                <Text
                  style={[
                    styles.redIcon,
                    { color: labelColor, fontFamily: 'SpaceMono-Regular' },
                  ]}
                >
                  {item.redIcon ?? item.key[0].toUpperCase()}
                </Text>
              ) : (
                <BottomTabIcon name={item.icon} color={labelColor} size={22} />
              )}
              {isActive && !isRedMode ? (
                <View
                  style={[
                    styles.activeDot,
                    {
                      backgroundColor: activeColor,
                      shadowColor: activeColor,
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                typography.tab,
                {
                  color: labelColor,
                  fontWeight: isActive ? '600' : '500',
                },
                isRedMode && { fontFamily: 'SpaceMono-Regular' },
              ]}
            >
              {item.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    gap: 4,
    maxWidth: 96,
  },
  iconWrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redIcon: {
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    letterSpacing: 0.2,
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 4,
  },
});

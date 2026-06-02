import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

interface MainHeaderIconButtonProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  active?: boolean;
  accessibilityLabel: string;
}

/** MAIN 우상단 글래스 아이콘 버튼 */
export function MainHeaderIconButton({
  icon,
  onPress,
  active = false,
  accessibilityLabel,
}: MainHeaderIconButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: theme.card,
          borderColor: active ? theme.primaryGlowBorder : theme.cardBorder,
          opacity: pressed ? 0.82 : 1,
        },
        active && {
          shadowColor: theme.primaryGlow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 2,
        },
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={active ? theme.primaryGlow : theme.foreground}
      />
      {active ? (
        <View
          style={[styles.activeDot, { backgroundColor: theme.primaryGlow }]}
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface DiarySectionHeaderProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export function DiarySectionHeader({
  icon,
  title,
  subtitle,
  trailing,
}: DiarySectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: theme.primaryGlowMuted,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Feather name={icon} size={18} color={theme.primaryGlow} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
});

import React from 'react';
import { Text, View } from 'react-native';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const badgeClassMap: Record<BadgeVariant, string> = {
  default: 'bg-primary border-primary',
  secondary: 'bg-muted border-muted',
  destructive: 'bg-destructive border-destructive',
  outline: 'bg-transparent border-border',
};

const textClassMap: Record<BadgeVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-foreground',
  destructive: 'text-foreground',
  outline: 'text-foreground',
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View
      className={`self-start rounded-full border px-2.5 py-1 ${badgeClassMap[variant]}`}
    >
      <Text className={`text-xs font-semibold ${textClassMap[variant]}`}>{label}</Text>
    </View>
  );
}


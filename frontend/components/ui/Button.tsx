import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-primary',
  outline: 'bg-transparent border-border',
  ghost: 'bg-muted border-muted',
  destructive: 'bg-destructive border-destructive',
};

const textClassMap: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  destructive: 'text-foreground',
};

export function Button({ label, variant = 'primary', ...props }: ButtonProps) {
  return (
    <Pressable
      className={`items-center rounded-xl border px-4 py-3 active:opacity-80 ${variantClassMap[variant]}`}
      {...props}
    >
      <Text className={`text-base font-semibold ${textClassMap[variant]}`}>{label}</Text>
    </Pressable>
  );
}


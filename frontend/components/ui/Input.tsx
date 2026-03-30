import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  errorMessage?: string;
}

export function Input({ label, errorMessage, ...props }: InputProps) {
  const hasError = Boolean(errorMessage);

  return (
    <View className="w-full">
      {label ? <Text className="mb-2 text-sm text-muted-foreground">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#A1A1AA"
        className={`rounded-xl border bg-card px-4 py-3 text-base text-foreground ${
          hasError ? 'border-destructive' : 'border-border'
        }`}
        {...props}
      />
      {hasError ? (
        <Text className="mt-1 text-xs text-destructive">{errorMessage}</Text>
      ) : null}
    </View>
  );
}


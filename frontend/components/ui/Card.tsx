import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';

interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function Card({ title, description, children, className = '' }: CardProps) {
  return (
    <View className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      {title ? (
        <Text className="text-lg font-semibold text-card-foreground">{title}</Text>
      ) : null}
      {description ? (
        <Text className="mt-1 text-sm text-muted-foreground">{description}</Text>
      ) : null}
      {children ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}


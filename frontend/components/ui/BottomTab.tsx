import React from 'react';
import { Pressable, Text, View } from 'react-native';

export interface BottomTabItem {
  key: string;
  label: string;
}

interface BottomTabProps {
  items: BottomTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function BottomTab({ items, activeKey, onChange }: BottomTabProps) {
  return (
    <View className="flex-row rounded-xl border border-border bg-card p-1">
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            className={`flex-1 items-center rounded-lg px-3 py-2 ${
              isActive ? 'bg-primary' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


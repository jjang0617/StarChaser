/**
 * Figma TabBar Lucide → @expo/vector-icons (SKY만 Ionicons sparkles)
 */

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type BottomTabIconName = 'home' | 'sky' | 'map' | 'log' | 'me';

interface BottomTabIconProps {
  name: BottomTabIconName;
  color: string;
  size?: number;
}

export function BottomTabIcon({ name, color, size = 22 }: BottomTabIconProps) {
  if (name === 'sky') {
    return <Ionicons name="sparkles" size={size} color={color} />;
  }

  const featherName: Record<
    Exclude<BottomTabIconName, 'sky'>,
    ComponentProps<typeof Feather>['name']
  > = {
    home: 'home',
    map: 'map',
    log: 'file-text',
    me: 'user',
  };

  return <Feather name={featherName[name]} size={size} color={color} />;
}

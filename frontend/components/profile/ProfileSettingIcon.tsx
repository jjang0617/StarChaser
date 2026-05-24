/**
 * Figma MeScreen Lucide 아이콘 → Feather (@expo/vector-icons) 매핑
 * Lucide와 동일 계열 라인 아이콘
 */

import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

export type ProfileSettingIconName =
  | 'bell'
  | 'star'
  | 'camera'
  | 'map-pin'
  | 'eye'
  | 'info'
  | 'shield'
  | 'file-text'
  | 'log-out'
  | 'user'
  | 'chevron-right';

const FEATHER_ICONS: Record<
  ProfileSettingIconName,
  ComponentProps<typeof Feather>['name']
> = {
  bell: 'bell',
  star: 'star',
  camera: 'camera',
  'map-pin': 'map-pin',
  eye: 'eye',
  info: 'info',
  shield: 'shield',
  'file-text': 'file-text',
  'log-out': 'log-out',
  user: 'user',
  'chevron-right': 'chevron-right',
};

interface ProfileSettingIconProps {
  name: ProfileSettingIconName;
  color: string;
  size?: number;
}

export function ProfileSettingIcon({
  name,
  color,
  size = 16,
}: ProfileSettingIconProps) {
  return <Feather name={FEATHER_ICONS[name]} size={size} color={color} />;
}

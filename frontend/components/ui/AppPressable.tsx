/**
 * 터치 피드백 — Material 리플(검은 둥근 사각형) 없음
 */

import React from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { androidPressableProps } from '../../lib/no-press-highlight';

const webNoOutline: StyleProp<ViewStyle> =
  Platform.OS === 'web' ? { outlineWidth: 0 } : null;

function resolveStyle(
  style: PressableProps['style'],
  pressed: boolean,
): StyleProp<ViewStyle> {
  const state = { pressed, hovered: false };
  const resolved = typeof style === 'function' ? style(state) : style;
  return [webNoOutline, resolved];
}

export function AppPressable({ style, children, ...rest }: PressableProps) {
  return (
    <Pressable
      {...androidPressableProps}
      style={(state) => resolveStyle(style, state.pressed)}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

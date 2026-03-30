/**
 * StarChaser — BottomTab
 * Anti-AI: 상단 2px 라인 인디케이터 (Glow 없음) · Solid 배경
 * Red Mode: 이모지 → ASCII 심볼 (Blue/Green 완전 제거)
 *
 * props는 기존 구조(items/activeKey/onChange) 유지하면서
 * 아이콘 지원 추가
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

export interface BottomTabItem {
  key:      string;
  label:    string;
  icon?:    string;       // 이모지 (normal/night 모드)
  redIcon?: string;       // ASCII 심볼 (red 모드) — Blue/Green 제거용
  hasDot?:  boolean;      // 미확인 알림 닷
}

interface BottomTabProps {
  items:     BottomTabItem[];
  activeKey: string;
  onChange:  (key: string) => void;
  style?:    ViewStyle;
}

export function BottomTab({ items, activeKey, onChange, style }: BottomTabProps) {
  const { theme, isRedMode } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.card,    // Solid — blur backdrop 없음
          borderTopColor:  theme.border,
        },
        style,
      ]}
    >
      {items.map(item => {
        const isActive     = item.key === activeKey;
        const activeColor  = theme.starGold;   // Red Mode에서도 theme.starGold = red
        const inactiveColor = theme.mutedForeground;
        const labelColor   = isActive ? activeColor : inactiveColor;

        // Red Mode: 이모지 → ASCII 심볼 (Blue/Green 계열 완전 제거)
        const displayIcon = isRedMode
          ? (item.redIcon ?? item.key[0].toUpperCase())
          : (item.icon ?? '');

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.tabItem,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            {/* 액티브 인디케이터: 상단 2px 라인 — Glow 없음 */}
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor: isActive ? activeColor : 'transparent',
                  // ⚠️ shadow/glow 없음
                },
              ]}
            />

            {/* 아이콘 */}
            {displayIcon ? (
              <View style={{ position: 'relative' }}>
                <Text
                  style={[
                    styles.icon,
                    isRedMode && {
                      fontFamily: 'SpaceMono-Regular',
                      color:      labelColor,
                    },
                  ]}
                >
                  {displayIcon}
                </Text>

                {/* 알림 닷 — 작고 절제 */}
                {item.hasDot && !isActive && (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: activeColor, borderColor: theme.background },
                    ]}
                  />
                )}
              </View>
            ) : null}

            {/* 라벨 — Space Mono */}
            <Text
              style={[
                styles.label,
                { color: labelColor },
              ]}
            >
              {item.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom:  20,   // safe area 대응
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:      0,
    paddingBottom:   2,
    position:       'relative',
  },
  indicator: {
    height:       2,
    width:        24,
    borderRadius: 1,
    marginBottom: 7,
    // ⚠️ shadow 없음
  },
  icon: {
    fontSize:   18,
    lineHeight: 20,
  },
  label: {
    fontFamily:    'SpaceMono-Regular',
    fontSize:       8,
    letterSpacing:  1,
    marginTop:      3,
  },
  dot: {
    position:     'absolute',
    top:          -2,
    right:        -5,
    width:         5,
    height:        5,
    borderRadius:  3,
    borderWidth:   1.5,
  },
});

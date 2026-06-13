import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  STAR_INDEX_ALERT_THRESHOLDS,
  type StarIndexAlertThreshold,
} from '../../lib/star-index-alert-threshold';
import { LOCATION_ALERT_THRESHOLD_HINT } from '../../lib/notification-copy';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';

interface StarIndexAlertThresholdPickerProps {
  selected: StarIndexAlertThreshold;
  disabled?: boolean;
  onSelect: (value: StarIndexAlertThreshold) => void;
}

/** ME 알림 설정 — Star-Index·위치한 곳 알림 공통 임계값 */
export function StarIndexAlertThresholdPicker({
  selected,
  disabled = false,
  onSelect,
}: StarIndexAlertThresholdPickerProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        알림 기준 점수
      </Text>
      <View style={styles.list}>
        {STAR_INDEX_ALERT_THRESHOLDS.map((t) => (
          <ThresholdOption
            key={t}
            theme={theme}
            value={t}
            selected={selected === t}
            disabled={disabled}
            onPress={() => onSelect(t)}
          />
        ))}
      </View>
      <Text style={[styles.hint, { color: theme.mutedForeground }]}>
        {LOCATION_ALERT_THRESHOLD_HINT}
      </Text>
    </View>
  );
}

function ThresholdOption({
  theme,
  value,
  selected,
  disabled,
  onPress,
}: {
  theme: ThemeTokens;
  value: StarIndexAlertThreshold;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={null}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${value}점 이상`}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? theme.primaryGlow : theme.borderSubtle,
          backgroundColor: selected
            ? theme.primaryGlowMuted
            : pressed
              ? theme.inputBackground
              : 'rgba(0,0,0,0.2)',
        },
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? theme.primaryGlow : theme.mutedForeground },
        ]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: theme.primaryGlow }]} />
        ) : null}
      </View>
      <Text
        style={[
          styles.optionLabel,
          { color: selected ? theme.foreground : theme.mutedForeground },
        ]}
      >
        {value}점 이상
      </Text>
      {selected ? (
        <Text style={[styles.badge, { color: theme.primaryGlow }]}>선택됨</Text>
      ) : (
        <View style={styles.badgeSpacer} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  list: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  badge: { fontSize: 11, fontWeight: '600' },
  badgeSpacer: { width: 36 },
  hint: { fontSize: 11, lineHeight: 16 },
});

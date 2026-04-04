import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

interface SelectFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  options: string[];
  onChange: (next: string) => void;
  style?: ViewStyle;
  /** 온보딩 등 어두운 배경에서 선택 필드를 더 잘 보이게 */
  emphasized?: boolean;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  placeholder = '선택',
  options,
  onChange,
  style,
  emphasized = false,
  disabled = false,
}: SelectFieldProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const display = value ?? '';
  const subtitle = display ? display : placeholder;

  const sortedOptions = useMemo(() => {
    // UI 안정성을 위해 정렬
    return [...options].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [options]);

  const btnBg = theme.input;
  const btnBorder = emphasized ? theme.ring : theme.border;
  const labelColor = theme.foreground;
  const valueColor = display ? theme.foreground : theme.mutedForeground;
  const chevronColor = theme.mutedForeground;

  return (
    <>
      <View style={[styles.wrap, style]}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        <Pressable
          onPress={() => {
            if (!disabled) setOpen(true);
          }}
          disabled={disabled}
          style={({ pressed }) => [
            styles.selectBtn,
            {
              backgroundColor: btnBg,
              borderColor: btnBorder,
              borderWidth: 1,
              borderRadius: emphasized ? 6 : theme.radius,
              opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.value, { color: valueColor }]}>
            {subtitle}
          </Text>
          <Text style={[styles.chevron, { color: chevronColor }]}>▼</Text>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderRadius: theme.radius,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
              {label}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {sortedOptions.map(opt => {
                const isActive = opt === value;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isActive ? theme.secondary : theme.input,
                        borderColor: isActive ? theme.ring : theme.borderSubtle,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isActive ? theme.ring : theme.foreground }]}>
                      {opt}
                    </Text>
                    {isActive && (
                      <Text style={{ color: theme.starGold, fontFamily: 'SpaceMono-Regular' }}>★</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.input,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.closeText, { color: theme.mutedForeground }]}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectBtn: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    borderWidth: 1,
    padding: 14,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  option: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sheetFooter: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  closeBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});


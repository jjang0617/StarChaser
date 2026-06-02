import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WeeklyTop3ItemDto } from '../../lib/types/api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { SkyTop3Panel } from '../sky/SkyTop3Panel';

interface MainTop3SheetProps {
  visible: boolean;
  onClose: () => void;
  top3Loading: boolean;
  top3Error: string | null;
  top3Items: WeeklyTop3ItemDto[] | null;
  selectedSpotId: string | null;
  onSelectTop3Spot: (spotId: string) => void;
}

export function MainTop3Sheet({
  visible,
  onClose,
  top3Loading,
  top3Error,
  top3Items,
  selectedSpotId,
  onSelectTop3Spot,
}: MainTop3SheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            glassCardStyle(theme),
            { marginTop: Math.max(insets.top, 12) + 56 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="trending-up" size={18} color={theme.primaryGlow} />
              <Text style={[styles.title, { color: theme.foreground }]}>주간 TOP3</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.lead, { color: theme.mutedForeground }]}>
            이번 주 Star-Index 평균이 높은 명소예요. 항목을 누르면 지도에서 위치를 볼 수
            있어요.
          </Text>
          <SkyTop3Panel
            layout="inline"
            top3Loading={top3Loading}
            top3Error={top3Error}
            top3Items={top3Items}
            selectedSpotId={selectedSpotId}
            onSelectTop3Spot={(id) => {
              onSelectTop3Spot(id);
              onClose();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
    maxWidth: 360,
    alignSelf: 'flex-end',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '600' },
  lead: { fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
});

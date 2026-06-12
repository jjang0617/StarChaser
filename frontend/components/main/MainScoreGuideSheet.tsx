import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAR_INDEX_GUIDE_ROWS } from '../../lib/star-index-guide';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';

interface MainScoreGuideSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MainScoreGuideSheet({ visible, onClose }: MainScoreGuideSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetMaxHeight = windowH * 0.78;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View
          style={[
            styles.sheet,
            glassCardStyle(theme),
            {
              marginTop: Math.max(insets.top, 12) + 48,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="info" size={18} color={theme.primaryGlow} />
              <Text style={[styles.title, { color: theme.foreground }]}>
                Star-Index 가이드
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
            showsVerticalScrollIndicator
            bounces
            nestedScrollEnabled
          >
            <Text style={[styles.lead, { color: theme.mutedForeground }]}>
              메인 화면 문구와 같은 기준으로 점수를 해석해요. 숫자가 높을수록 별·은하수
              관측에 유리한 밤에 가깝습니다.
            </Text>

            {STAR_INDEX_GUIDE_ROWS.map((row) => (
              <GuideRow key={row.title} theme={theme} row={row} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function GuideRow({
  theme,
  row,
}: {
  theme: ThemeTokens;
  row: (typeof STAR_INDEX_GUIDE_ROWS)[number];
}) {
  return (
    <View style={[styles.row, { borderColor: theme.borderSubtle }]}>
      <View style={[styles.badge, { backgroundColor: theme.primaryGlowMuted }]}>
        <Text style={[styles.badgeText, { color: theme.primaryGlow }]}>{row.badge}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: theme.foreground }]}>{row.title}</Text>
      <Text style={[styles.rowBody, { color: theme.mutedForeground }]}>{row.body}</Text>
    </View>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '600' },
  lead: { fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowBody: { fontSize: 13, lineHeight: 19 },
});

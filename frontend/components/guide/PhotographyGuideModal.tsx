import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { Button } from '../ui';

interface PhotographyGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PhotographyGuideModal({
  visible,
  onClose,
}: PhotographyGuideModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.background,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            별·야경 촬영 기본 가이드
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Text style={[styles.headerClose, { color: theme.starGold }]}>닫기</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GuideSection theme={theme} title="준비물">
            <Bullet theme={theme}>삼각대 — 긴 노출 시 흔들림 방지에 필수입니다.</Bullet>
            <Bullet theme={theme}>보조 배터리·메모리 여유 — 야외·저온에서 방전이 빠릅니다.</Bullet>
            <Bullet theme={theme}>
              조명은 가능하면 적색 LED 등으로 암순화를 해치지 않게 합니다.
            </Bullet>
          </GuideSection>

          <GuideSection theme={theme} title="스마트폰 (참고값)">
            <Text style={[styles.para, { color: theme.mutedForeground }]}>
              기기·앱마다 메뉴 이름이 다릅니다. 전문/프로 모드·야간 모드·수동(M)이 있으면 우선합니다.
            </Text>
            <Bullet theme={theme}>ISO: 대략 800 ~ 3200 — 노이즈와 밝기의 균형을 맞춥니다.</Bullet>
            <Bullet theme={theme}>
              셔터: 별점(선)을 줄이려면 대략 10 ~ 25초 전후부터 시도합니다. 초점은 무한대에 맞춥니다.
            </Bullet>
            <Bullet theme={theme}>
              셀프 타이머·리모컨·연사로 기기 진동을 줄입니다.
            </Bullet>
          </GuideSection>

          <GuideSection theme={theme} title="유성우·넓은 하늘">
            <Bullet theme={theme}>가능하면 넓은 화각으로 하늘 넓은 영역을 담습니다.</Bullet>
            <Bullet theme={theme}>달이 밝으면 유성이 약해 보일 수 있어 일정을 참고합니다.</Bullet>
            <Bullet theme={theme}>연속 촬영으로 도약만 포착하는 경우도 있습니다.</Bullet>
          </GuideSection>

          <GuideSection theme={theme} title="DSLR·미러리스">
            <Text style={[styles.para, { color: theme.mutedForeground }]}>
              조리개는 렌즈에 맞게 조정합니다. 어두운 렌즈라면 ISO를 조금 더 올려 노출을 맞춥니다.
            </Text>
            <Bullet theme={theme}>RAW 저장이 가능하면 후보정 여지가 큽니다.</Bullet>
          </GuideSection>

          <GuideSection theme={theme} title="안전·예절">
            <Bullet theme={theme}>발밑·장비 배치를 확인하고, 낙석·야간 동물 구역은 표지를 따릅니다.</Bullet>
            <Bullet theme={theme}>사유지·금지 구역은 출입하지 않습니다.</Bullet>
            <Bullet theme={theme}>백색 손전등은 다른 관측자에게 방해가 됩니다.</Bullet>
          </GuideSection>

          <Text style={[styles.disclaimer, { color: theme.mutedForeground }]}>
            본 내용은 일반 참고용이며 기기 매뉴얼·현장 안전 수칙이 우선합니다.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button label="확인" variant="primary" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function GuideSection({
  theme,
  title,
  children,
}: {
  theme: ThemeTokens;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ theme, children }: { theme: ThemeTokens; children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: theme.starGold }]}>•</Text>
      <Text style={[styles.bulletText, { color: theme.moonlight }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, paddingRight: 12 },
  headerClose: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  para: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { fontSize: 14, lineHeight: 21, width: 18 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 21 },
  disclaimer: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

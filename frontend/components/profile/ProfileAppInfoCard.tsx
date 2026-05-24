import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../content/legal-documents';
import { getAppVersionLabel, getAppVersionSubLabel } from '../../lib/app-info';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { Card } from '../ui';
import { LegalDocumentModal } from './LegalDocumentModal';

type LegalKind = 'terms' | 'privacy';

export function ProfileAppInfoCard() {
  const { theme } = useTheme();
  const [legalOpen, setLegalOpen] = useState<LegalKind | null>(null);

  const versionLabel = getAppVersionLabel();
  const versionSub = getAppVersionSubLabel();

  return (
    <>
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>앱 정보</Text>
        <Text style={[styles.sectionDesc, { color: theme.mutedForeground }]}>
          버전 확인 및 약관·개인정보 안내
        </Text>

        <View style={[styles.versionRow, { borderColor: theme.border }]}>
          <Text style={[styles.versionLabel, { color: theme.foreground }]}>버전</Text>
          <View style={styles.versionValueCol}>
            <Text style={[styles.versionValue, { color: theme.foreground }]}>
              {versionLabel}
            </Text>
            {versionSub ? (
              <Text style={[styles.versionSub, { color: theme.mutedForeground }]}>
                {versionSub}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.list, { borderColor: theme.border }]}>
          <LinkRow label="이용약관" theme={theme} onPress={() => setLegalOpen('terms')} />
          <LinkRow
            label="개인정보 처리방침"
            theme={theme}
            onPress={() => setLegalOpen('privacy')}
            isLast
          />
        </View>
      </Card>

      <LegalDocumentModal
        visible={legalOpen === 'terms'}
        title="이용약관"
        content={TERMS_OF_SERVICE}
        onClose={() => setLegalOpen(null)}
      />
      <LegalDocumentModal
        visible={legalOpen === 'privacy'}
        title="개인정보 처리방침"
        content={PRIVACY_POLICY}
        onClose={() => setLegalOpen(null)}
      />
    </>
  );
}

function LinkRow({
  label,
  theme,
  onPress,
  isLast,
}: {
  label: string;
  theme: ThemeTokens;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        { opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.linkLabel, { color: theme.foreground }]}>{label}</Text>
      <Text style={[styles.chevron, { color: theme.mutedForeground }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 12,
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '500',
    paddingTop: 1,
  },
  versionValueCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  versionValue: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SpaceMono-Regular',
  },
  versionSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  linkLabel: { fontSize: 15, fontWeight: '500' },
  chevron: { fontSize: 20, lineHeight: 22 },
});

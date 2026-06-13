import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../content/legal-documents';
import { spacing } from '../../themes/design-tokens';
import { getAppVersionLabel, getAppVersionSubLabel } from '../../lib/app-info';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { GlassCard } from '../ui/GlassCard';
import { LegalDocumentModal } from './LegalDocumentModal';
import { ProfileSettingIcon, type ProfileSettingIconName } from './ProfileSettingIcon';

type LegalKind = 'terms' | 'privacy';

export function ProfileAppInfoCard() {
  const { theme } = useTheme();
  const [legalOpen, setLegalOpen] = useState<LegalKind | null>(null);

  const versionLabel = getAppVersionLabel();
  const versionSub = getAppVersionSubLabel();

  return (
    <>
      <GlassCard padding={8}>
        <InfoRow
          theme={theme}
          icon="info"
          title="버전"
          subtitle={versionSub || 'StarChaser'}
          trailingText={versionLabel}
        />
        <InfoRow
          theme={theme}
          icon="file-text"
          title="이용약관"
          chevron
          onPress={() => setLegalOpen('terms')}
        />
        <InfoRow
          theme={theme}
          icon="shield"
          title="개인정보 처리방침"
          chevron
          onPress={() => setLegalOpen('privacy')}
          isLast
        />
      </GlassCard>

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

function InfoRow({
  theme,
  icon,
  title,
  subtitle,
  trailingText,
  chevron,
  onPress,
  isLast,
}: {
  theme: ThemeTokens;
  icon: ProfileSettingIconName;
  title: string;
  subtitle?: string;
  trailingText?: string;
  chevron?: boolean;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const inner = (
    <>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.primaryGlowMuted, borderColor: theme.primaryGlowBorder },
        ]}
      >
        <ProfileSettingIcon name={icon} color={theme.primaryGlow} size={16} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailingText ? (
        <Text style={[styles.trailing, { color: theme.foreground }]}>{trailingText}</Text>
      ) : chevron ? (
        <ProfileSettingIcon name="chevron-right" color={theme.mutedForeground} size={18} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    !isLast && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderSubtle,
    },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.88 : 1 }]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{inner}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  trailing: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

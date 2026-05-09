import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';

interface ProfileTabScreenProps {
  email: string | null;
  onLogout: () => void;
  isRedMode: boolean;
  onToggleRedMode: () => void;
  onDevResetOnboarding?: () => void;
}

export function ProfileTabScreen({
  email,
  onLogout,
  isRedMode,
  onToggleRedMode,
  onDevResetOnboarding,
}: ProfileTabScreenProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.foreground }]}>마이페이지</Text>
      <Card
        title="계정"
        description="설정·Pro 등은 Phase 1 이후(B 담당 영역과 통합)"
      >
        <Text style={[styles.email, { color: theme.mutedForeground }]}>
          {email ?? '—'}
        </Text>
        <View style={{ marginTop: 12 }}>
          <Button label="로그아웃" variant="outline" fullWidth onPress={onLogout} />
        </View>
      </Card>
      <Card title="표시" description="야간 관측 시 눈부심을 줄입니다">
        <Button
          label={isRedMode ? '야간 모드(Night Vision) 해제' : '야간 모드(Night Vision) 켜기'}
          variant="red"
          fullWidth
          onPress={onToggleRedMode}
        />
      </Card>
      {onDevResetOnboarding ? (
        <Card title="개발" description="온보딩 플로우만 다시 봅니다">
          <Button
            label="DEV: 온보딩 다시보기"
            variant="outline"
            fullWidth
            onPress={onDevResetOnboarding}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 16 },
  email: { fontSize: 14 },
});

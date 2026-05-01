import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { Button, Card } from '../ui';

interface ProfileTabScreenProps {
  email: string | null;
  onLogout: () => void;
}

export function ProfileTabScreen({ email, onLogout }: ProfileTabScreenProps) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 16 },
  email: { fontSize: 14 },
});

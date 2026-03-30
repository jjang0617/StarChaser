/**
 * StarChaser — App.tsx
 * ThemeProvider로 전체 감싸기
 * 기존 App 구조 유지하면서 새 컴포넌트 적용
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './themes/ThemeContext';
import {
  Badge,
  BottomTab,
  Button,
  Card,
  StarIndexCard,
  SpotCard,
  Input,
  Screen,
} from './components/ui';

// ── 실제 앱 내용 — ThemeProvider 안에서 useTheme() 사용 가능 ──
function AppContent() {
  const { theme, toggleRed, isRedMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [location, setLocation]   = useState<string>('');

  return (
    <Screen>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 헤더 */}
          <Text style={[styles.appTitle, { color: theme.foreground, fontFamily: 'SpaceMono-Regular' }]}>
            StarChaser
          </Text>
          <Text style={[styles.appSub, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
            Anti-AI Component v2.0
          </Text>

          {/* Badge 샘플 */}
          <View style={styles.row}>
            <Badge label="Bortle 3" variant="gold" mono />
            <Badge label="▲ 757m" variant="steel" mono />
            <Badge label="주차" variant="muted" />
            <Badge label="Red Mode" variant="red" />
          </View>

          {/* Star-Index 카드 */}
          <StarIndexCard
            score={78}
            cloudCover={15}
            pm25Level="보통"
            moonAltitude={12}
          />

          {/* 명소 카드 */}
          <SpotCard
            name="화왕산 억새평원"
            region="창녕군"
            elevation={757}
            bortleClass={3}
            starIndex={78}
            hasParking
            hasToilet
            distanceKm={23}
          />

          {/* 기본 Card */}
          <Card title="오늘의 관측 조건" description="기상/달/광공해 데이터 기반 실시간 계산">
            <View style={styles.cardInner}>
              <Input
                label="관측 위치"
                placeholder="강원 영월 별마로천문대"
                value={location}
                onChangeText={setLocation}
                monoLabel
              />
              <Button label="관측 시작하기" fullWidth />
              <Button label="관측지 둘러보기" variant="outline" fullWidth />
              <Button
                label={isRedMode ? '야간 모드 해제' : '🔴 Night Vision ON'}
                variant="red"
                fullWidth
                onPress={toggleRed}
              />
            </View>
          </Card>
        </ScrollView>

        {/* BottomTab */}
        <View style={styles.tabWrap}>
          <BottomTab
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'home',    label: 'Home',   icon: '⭐', redIcon: '★' },
              { key: 'map',     label: 'Map',    icon: '🗺',  redIcon: '◈', hasDot: true },
              { key: 'sky',     label: 'Sky',    icon: '🌌', redIcon: '◉' },
              { key: 'records', label: 'Log',    icon: '📋', redIcon: '≡' },
              { key: 'profile', label: 'Me',     icon: '👤', redIcon: '○' },
            ]}
          />
        </View>
      </View>
    </Screen>
  );
}

// ── 루트: ThemeProvider로 전체 감싸기 ──
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap:         12,
    paddingBottom: 20,
  },
  appTitle: {
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize:      10,
    letterSpacing:  1,
  },
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            6,
  },
  cardInner: {
    gap: 8,
  },
  tabWrap: {
    paddingTop: 4,
  },
});

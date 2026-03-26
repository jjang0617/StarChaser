import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Badge, BottomTab, Button, Card, Input, Screen } from './components/ui';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [location, setLocation] = useState<string>('');

  return (
    <SafeAreaProvider>
      <Screen>
        <StatusBar style="light" />
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 pb-6"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-3xl font-bold text-foreground">StarChaser</Text>
            <Text className="text-sm text-muted-foreground">
              Night 스타일 가이드 v1
            </Text>

            <View className="flex-row flex-wrap gap-2">
              <Badge label="Night Version" />
              <Badge label="Star-Index 78" variant="secondary" />
              <Badge label="주의" variant="destructive" />
              <Badge label="Outline" variant="outline" />
            </View>

            <Card
              title="오늘의 관측 조건"
              description="Star-Index는 기상/달/광공해 데이터를 기반으로 계산됨."
            >
              <View className="gap-3">
                <Input
                  label="관측 위치"
                  placeholder="예: 강원 영월 별마로천문대"
                  value={location}
                  onChangeText={setLocation}
                />
                <Button label="관측 시작하기" />
                <Button label="관측지 둘러보기" variant="outline" />
              </View>
            </Card>
          </ScrollView>

          <View className="pt-2">
            <BottomTab
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                { key: 'home', label: '홈' },
                { key: 'map', label: '지도' },
                { key: 'records', label: '기록' },
              ]}
            />
          </View>
        </View>
      </Screen>
    </SafeAreaProvider>
  );
}

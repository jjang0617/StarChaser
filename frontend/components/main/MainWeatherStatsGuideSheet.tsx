import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
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
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';

export type WeatherStatType = 'sun' | 'lightPollution' | 'cloud' | 'moon' | 'humidity' | 'pm25';

interface MainWeatherStatsGuideSheetProps {
  visible: boolean;
  onClose: () => void;
  initialStat?: WeatherStatType;
}

interface StatGuideDetail {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  lead: string;
  primaryExplain: string;
  secondaryExplain: string;
  rows: { badge: string; text: string }[];
}

const STATS_GUIDE_DATA: Record<WeatherStatType, StatGuideDetail> = {
  sun: {
    title: '태양고도 가이드',
    icon: 'sun',
    lead: '태양의 각도를 나타내는 지표로, 해가 지평선 아래로 멀리 내려갈수록 어두운 별 관측용 밤하늘이 열립니다.',
    primaryExplain: '현재 시점의 태양 고도각(°)입니다. 음수 값이 깊어질수록 어두움을 뜻합니다.',
    secondaryExplain: '태양 각도에 따른 박명(Twilight) 구간과 완벽한 밤(Night) 상태를 한글로 구별해 보여줍니다. 오전은 여명, 오후는 황혼으로 자동 감지하여 표시합니다.',
    rows: [
      { badge: '낮 (Daylight)', text: '고도 0° 이상. 햇빛이 공기 중에 산란하여 별을 전혀 관측할 수 없는 상태입니다.' },
      { badge: '시민여명/황혼', text: '고도 -6° ~ 0°. 가장 밝은 인공위성이나 금성 같은 극히 소수의 행성만 겨우 보입니다.' },
      { badge: '항해여명/황혼', text: '고도 -12° ~ -6°. 밤하늘의 옅은 밝기가 지속되며 1~2등성급 밝은 별들이 시야에 들어옵니다.' },
      { badge: '천문여명/황혼', text: '고도 -18° ~ -12°. 일반적인 눈에는 거의 밤으로 느껴지며 6등성까지의 은근한 별들도 시야에 드러나기 시작합니다.' },
      { badge: '밤 (Night)', text: '고도 -18° 이하. 태양 빛의 영향이 전혀 미치지 않는 완전한 어둠 상태로 별 관측을 위한 황금 시간대입니다.' },
    ],
  },
  lightPollution: {
    title: '빛공해 가이드',
    icon: 'zap',
    lead: '가까운 인공 광원이 밤하늘을 얼마나 밝히고 있는지를 측정한 광공해 수준 지표입니다.',
    primaryExplain: '해당 위치의 광해 지도를 참조한 Bortle Class 등급(1급~9급)입니다.',
    secondaryExplain: '인공 밤하늘의 광채를 백분율 점수로 치환한 수치입니다. 점수가 높을수록 광해가 없고 깨끗합니다.',
    rows: [
      { badge: 'Bortle 1~2급', text: '자연 그대로의 밤하늘. 주변에 도시 광원이 없어 은하수 중심부와 먼 우주 천체까지 육안으로 관측 가능합니다.' },
      { badge: 'Bortle 3~4급', text: '시골~교외 밤하늘. 지평선 쪽에 미세한 광해 돔이 보이지만, 머리 위 하늘은 은하수가 뚜렷하게 관측됩니다.' },
      { badge: 'Bortle 5~6급', text: '도시 근교. 밤하늘이 눈에 띄게 밝고 광해가 번져 은하수가 희미하거나 아예 보이지 않으며 대형 별자리 위주로 관측됩니다.' },
      { badge: 'Bortle 7~9급', text: '대도시 도심지. 강력한 네온사인과 가로등 불빛으로 하늘 전체가 뿌옇고 밤하늘의 별을 거의 볼 수 없습니다.' },
    ],
  },
  cloud: {
    title: '구름 가이드',
    icon: 'cloud',
    lead: '하늘에 떠 있는 구름의 양을 나타냅니다. 구름은 별을 직접적으로 가리는 가장 중대한 기상 요인입니다.',
    primaryExplain: '기상청 예보 기준 하늘 상태(맑음, 구름조금, 구름많음, 흐림)를 나타냅니다.',
    secondaryExplain: '구름이 하늘 전체를 덮고 있는 실제 비율(0% ~ 100%)을 나타냅니다.',
    rows: [
      { badge: '맑음', text: '구름 덮임량 0% ~ 20%. 하늘이 거의 다 깨끗하게 열려 우주 관측에 가장 완벽한 상태를 의미합니다.' },
      { badge: '구름조금', text: '구름 덮임량 21% ~ 45%. 듬성듬성 흘러가는 구름이 있지만 맑은 하늘 틈새로 관측이 가능한 무난한 환경입니다.' },
      { badge: '구름많음', text: '구름 덮임량 46% ~ 75%. 하늘의 반 이상이 불투명하게 가려져 관측 범위가 극도로 좁아집니다.' },
      { badge: '흐림', text: '구름 덮임량 76% ~ 100%. 온 하늘이 구름막으로 단단히 싸여 있어 야간 관측을 진행할 수 없습니다.' },
    ],
  },
  moon: {
    title: '달고도 가이드',
    icon: 'moon',
    lead: '달의 높이와 크기는 밤하늘의 밝기를 결정합니다. 지평선 아래로 숨어 달빛 방해가 없는 상태가 가장 이상적입니다.',
    primaryExplain: '현재 달의 고도각(°)입니다. 0° 이하(지평선 아래)일 때 달빛 방해가 차단됩니다.',
    secondaryExplain: '현재 달의 위상과 모양(초승달, 보름달 등)을 텍스트로 표기해 줍니다.',
    rows: [
      { badge: '지평선 아래', text: '달고도 0° 미만인 상태. 달이 완전히 졌으므로 달의 위상과 무관하게 밤하늘이 가장 깊고 어둡게 보존됩니다.' },
      { badge: '삭 (그믐)', text: '달이 완전히 어두워 고도가 떠 있더라도 반사되는 빛이 없어 별 관측에 방해가 없습니다.' },
      { badge: '초승달 / 그믐달', text: '일부만 얇게 빛나는 위상으로, 달빛 영향이 미미해 관측에 유리합니다.' },
      { badge: '반달 (상현 / 하현)', text: '하늘의 절반이 노출되어 밤하늘을 일부분 비추기 때문에, 어두운 성운·은하 관측은 약간의 제약을 받습니다.' },
      { badge: '망 (보름달)', text: '가장 밝은 위상으로 강력한 밤하늘 광원이 되어 별빛들이 달빛에 가려집니다.' },
    ],
  },
  humidity: {
    title: '습도 가이드',
    icon: 'droplet',
    lead: '대기 중 수증기 함량입니다. 습도가 높으면 안개, 이슬이 쉽게 맺히고 대기가 탁해져 별빛 산란이 심해집니다.',
    primaryExplain: '관측 쾌적도 상태(쾌적, 보통, 습함)를 의미합니다.',
    secondaryExplain: '습도가 관측 환경에 주는 부정적 영향을 점수화(0~100점)하여 높을수록 맑고 건조함을 나타냅니다.',
    rows: [
      { badge: '쾌적', text: '대기가 건조하고 맑아 안개나 이슬 발생 확률이 매우 낮으며 밤하늘 시야가 뚜렷합니다.' },
      { badge: '보통', text: '일반적인 공기 조건으로 야간 관측에 큰 무리를 야기하지 않는 범위입니다.' },
      { badge: '습함', text: '대기 중의 수증기가 포화 상태에 도달했습니다. 이슬이나 안개가 형성되기 쉬워 렌즈가 흐려지거나 빛 번짐이 유발될 수 있습니다.' },
    ],
  },
  pm25: {
    title: '미세먼지 가이드',
    icon: 'activity',
    lead: '대기 중 초미세먼지(PM 2.5) 입자의 농도로, 공기 속의 미세 입자가 별빛을 흡수·굴절시켜 투명도를 크게 떨어뜨립니다.',
    primaryExplain: '가장 가까운 관측소 기준 실시간 초미세먼지 농도 수치(µg/m³)입니다.',
    secondaryExplain: '미세먼지 농도에 맞추어 판정된 대기 오염 등급(좋음, 보통, 나쁨, 매우나쁨)입니다.',
    rows: [
      { badge: '좋음 (0 ~ 15)', text: '공기가 맑아 먼지로 인한 시야 왜곡이 발생하지 않고 최상의 투명도를 확보할 수 있습니다.' },
      { badge: '보통 (16 ~ 35)', text: '평이한 공기질 수준이며 일반적인 밤하늘 별 관측에 큰 악영향은 유발하지 않습니다.' },
      { badge: '나쁨 (36 ~ 75)', text: '대기가 불투명하게 변하고 빛이 어지럽게 흩어져 밤하늘의 옅은 우주 천체를 포착하기 불리해집니다.' },
      { badge: '매우나쁨 (76~)', text: '초미세먼지 안개가 심해 지상의 불빛들이 퍼져 보여 야외 관측이 불가능합니다.' },
    ],
  },
};

export function MainWeatherStatsGuideSheet({
  visible,
  onClose,
  initialStat = 'sun',
}: MainWeatherStatsGuideSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetMaxHeight = windowH * 0.82;

  const [activeStat, setActiveStat] = useState<WeatherStatType>(initialStat);

  useEffect(() => {
    if (visible) {
      setActiveStat(initialStat);
    }
  }, [visible, initialStat]);

  const tabs: { type: WeatherStatType; label: string }[] = [
    { type: 'sun', label: '태양고도' },
    { type: 'lightPollution', label: '빛공해' },
    { type: 'cloud', label: '구름' },
    { type: 'moon', label: '달고도' },
    { type: 'humidity', label: '습도' },
    { type: 'pm25', label: '미세먼지' },
  ];

  const currentData = STATS_GUIDE_DATA[activeStat];

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name={currentData.icon} size={18} color={theme.primaryGlow} />
              <Text style={[styles.title, { color: theme.foreground }]}>
                {currentData.title}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>

          {/* Horizontally Scrollable Selector Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: theme.borderSubtle }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarContent}
            >
              {tabs.map((tab) => {
                const isActive = tab.type === activeStat;
                return (
                  <Pressable
                    key={tab.type}
                    onPress={() => setActiveStat(tab.type)}
                    style={[
                      styles.tabButton,
                      isActive && { borderBottomColor: theme.primaryGlow },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: isActive ? theme.primaryGlow : theme.mutedForeground },
                        isActive && { fontWeight: '700' },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Details Scroll Content */}
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
              {currentData.lead}
            </Text>

            {/* Sub/Primary Description Callout Box */}
            <View style={[styles.explainBox, { backgroundColor: theme.borderSubtle, borderColor: theme.border }]}>
              <View style={styles.explainRow}>
                <View style={[styles.explainDot, { backgroundColor: theme.primaryGlow }]} />
                <Text style={[styles.explainText, { color: theme.foreground }]}>
                  <Text style={{ fontWeight: '700' }}>주 내용: </Text>
                  {currentData.primaryExplain}
                </Text>
              </View>
              <View style={styles.explainRow}>
                <View style={[styles.explainDot, { backgroundColor: theme.moonlight }]} />
                <Text style={[styles.explainText, { color: theme.foreground }]}>
                  <Text style={{ fontWeight: '700' }}>부 내용: </Text>
                  {currentData.secondaryExplain}
                </Text>
              </View>
            </View>

            {/* Grid/Rows */}
            <View style={styles.rowsContainer}>
              {currentData.rows.map((row) => (
                <View key={row.badge} style={[styles.row, { borderColor: theme.borderSubtle }]}>
                  <View style={[styles.badge, { backgroundColor: theme.primaryGlowMuted }]}>
                    <Text style={[styles.badgeText, { color: theme.primaryGlow }]}>
                      {row.badge}
                    </Text>
                  </View>
                  <Text style={[styles.rowBody, { color: theme.mutedForeground }]}>
                    {row.text}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
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
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  tabBar: {
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  tabBarContent: {
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: spacing.sm,
  },
  lead: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  explainBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 8,
    marginBottom: spacing.sm,
  },
  explainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  explainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  explainText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  rowsContainer: {
    gap: spacing.sm,
  },
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
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});

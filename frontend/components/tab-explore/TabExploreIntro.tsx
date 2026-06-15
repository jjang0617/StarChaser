import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';
import { IntroMapBackdrop } from './IntroMapBackdrop';
import { IntroSkyBackdrop } from './IntroSkyBackdrop';

export type TabExploreVariant = 'sky' | 'map';

interface TabExploreIntroProps {
  variant: TabExploreVariant;
  titleLine1?: string;
  titleHighlight?: string;
  titleLine2?: string;
  subtitle?: string;
  buttonLabel?: string;
  onExplore: () => void;
  mapPreviewReady?: boolean;
}

const COPY: Record<
  TabExploreVariant,
  {
    titleLine1: string;
    titleHighlight: string;
    titleLine2: string;
    subtitle: string;
    buttonLabel: string;
  }
> = {
  sky: {
    titleLine1: '가상 스카이 뷰어',
    titleHighlight: '',
    titleLine2: '',
    subtitle:
      '떠 있는 별을 손끝으로 짚어 보세요.\n지금 이곳의 하늘을 그대로 펼쳐 드릴게요.',
    buttonLabel: '밤하늘 보기',
  },
  map: {
    titleLine1: '관측 명소',
    titleHighlight: '지도',
    titleLine2: '로 찾아가요',
    subtitle:
      '전국 별 관측 명소와 Star-Index.\n광공해를 켜면 불빛이 덜한 곳을 찾을 수 있어요.',
    buttonLabel: '지도 열기',
  },
};

/** MAP 인트로 — 제목 카드·지도 열기 버튼 공통 */
const MAP_PANEL_BG = 'rgba(3, 7, 18, 0.62)';

const textShadowStrong = {
  textShadowColor: 'rgba(0,0,0,0.85)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
} as const;

export function TabExploreIntro({
  variant,
  titleLine1,
  titleHighlight,
  titleLine2,
  subtitle,
  buttonLabel,
  onExplore,
  mapPreviewReady = false,
}: TabExploreIntroProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(12);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [variant, fade, rise]);

  const preset = COPY[variant];
  const isMap = variant === 'map';

  const line1 = titleLine1 ?? preset.titleLine1;
  const highlight = titleHighlight ?? preset.titleHighlight;
  const line2 = titleLine2 ?? preset.titleLine2;
  const sub = subtitle ?? preset.subtitle;
  const btn = buttonLabel ?? preset.buttonLabel;

  return (
    <View style={styles.root}>
      {variant === 'sky' ? <IntroSkyBackdrop /> : null}
      {isMap && !mapPreviewReady ? <IntroMapBackdrop /> : null}

      <Animated.View
        style={[
          styles.inner,
          {
            opacity: fade,
            transform: [{ translateY: rise }],
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <View style={styles.iconRow}>
          {variant === 'sky' ? (
            <Ionicons name="sparkles" size={26} color={theme.primaryGlow} />
          ) : (
            <Feather name="map" size={24} color={theme.primaryGlow} />
          )}
        </View>

        <View
          style={[
            styles.headlineBlock,
            isMap && {
              backgroundColor: MAP_PANEL_BG,
              borderWidth: 1,
              borderColor: theme.primaryGlowBorder,
            },
          ]}
        >
          {line1 ? (
            <Text
              style={[
                styles.headlineLine1,
                { color: theme.foreground },
                textShadowStrong,
              ]}
            >
              {line1}
            </Text>
          ) : null}
          {highlight || line2 ? (
            <Text
              style={[
                styles.headlineLine2,
                { color: theme.foreground },
                textShadowStrong,
              ]}
            >
              {highlight ? (
                <Text style={[styles.headlineHighlight, { color: theme.primaryGlow }]}>
                  {highlight}
                </Text>
              ) : null}
              {line2}
            </Text>
          ) : null}
          <Text
            style={[
              styles.subtitle,
              {
                color: isMap ? theme.foreground : theme.mutedForeground,
                opacity: isMap ? 0.92 : 1,
              },
              textShadowStrong,
            ]}
          >
            {sub}
          </Text>
        </View>

        <View style={styles.ctaWrap}>
          <Button
            label={btn}
            variant="primary"
            fullWidth
            size="md"
            onPress={onExplore}
            style={
              isMap
                ? {
                    backgroundColor: MAP_PANEL_BG,
                    borderWidth: 1,
                    borderColor: theme.primaryGlowBorder,
                  }
                : undefined
            }
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 340,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    zIndex: 2,
  },
  iconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
  },
  headlineBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 16,
  },
  headlineLine1: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headlineLine2: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 34,
  },
  headlineHighlight: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
  ctaWrap: {
    width: '100%',
    marginTop: spacing.xs,
  },
});

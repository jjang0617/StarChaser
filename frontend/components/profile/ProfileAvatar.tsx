import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { profileLetter } from '../../lib/profile-display';

export function ProfileAvatar({
  nickname,
  avatarUrl,
  size = 72,
  style,
}: {
  nickname: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
  style?: ImageStyle;
}) {
  const { theme } = useTheme();
  const letter = profileLetter(nickname);
  const radius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius, borderColor: theme.border },
          style,
        ]}
        accessibilityLabel="프로필 사진"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.input,
          borderColor: theme.ring,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.letter,
          {
            color: theme.starGold,
            fontSize: Math.round(size * 0.38),
          },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  letter: {
    fontWeight: '700',
  },
});

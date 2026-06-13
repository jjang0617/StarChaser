/**
 * 앱 스플래시와 동일한 풀스크린 브랜딩 배경
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export function AuthWelcomeBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={require('../../assets/splash-starchaser.png')}
        style={styles.image}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel="StarChaser"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

/**
 * Figma Splash — 앱 최초 진입(콜드 스타트) 브랜딩 화면
 */

import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export function SplashScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/splash-starchaser.png')}
        style={styles.image}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel="StarChaser — Virtual Sky, Top Spots, Clear Skies Score"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#030712',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

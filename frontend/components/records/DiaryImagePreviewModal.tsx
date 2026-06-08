/**
 * 일기 사진 전체 화면 미리보기 — 좌우 스와이프 · 닫기
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

export interface DiaryPreviewPhoto {
  id: string;
  imageUrl: string;
}

interface DiaryImagePreviewModalProps {
  visible: boolean;
  photos: DiaryPreviewPhoto[];
  initialIndex?: number;
  onClose: () => void;
}

export function DiaryImagePreviewModal({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: DiaryImagePreviewModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlatList<DiaryPreviewPhoto>>(null);
  const safeIndex = Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0));
  const [activeIndex, setActiveIndex] = useState(safeIndex);

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(safeIndex);
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: safeIndex, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, safeIndex]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / screenWidth);
      if (next >= 0 && next < photos.length) {
        setActiveIndex(next);
      }
    },
    [photos.length, screenWidth],
  );

  if (photos.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Feather name="x" size={24} color={theme.foreground} />
          </Pressable>
          {photos.length > 1 ? (
            <Text style={[styles.counter, { color: theme.mutedForeground }]}>
              {activeIndex + 1} / {photos.length}
            </Text>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={photos.length > 1}
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          style={styles.list}
          initialScrollIndex={photos.length > 1 ? safeIndex : undefined}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onMomentumScrollEnd={onScrollEnd}
          onScrollToIndexFailed={() => {
            /* 레이아웃 직후 재시도는 useEffect에서 처리 */
          }}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width: screenWidth, height: screenHeight * 0.72 }]}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="일기 사진 크게 보기"
              />
            </View>
          )}
        />

        <View style={{ height: insets.bottom + spacing.md }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

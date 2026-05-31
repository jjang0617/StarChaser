import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 1:1 정사각형 틀 안에서 이미지를 드래그/확대해 위치를 맞추고 그 영역을 잘라 반환한다.
 * 자르기 틀(흰색 테두리)은 이미지 영역에 두고, 컨트롤은 틀 위/아래 바깥으로 분리한다.
 */
export function ProfileImageCropModal({
  visible,
  image,
  onCancel,
  onCropped,
}: {
  visible: boolean;
  image: PickedImage | null;
  onCancel: () => void;
  onCropped: (uri: string) => void;
}) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [busy, setBusy] = useState(false);

  const frameSize = Math.min(screenWidth - 48, 320);

  const layout = useMemo(() => {
    if (!image || image.width <= 0 || image.height <= 0) return null;
    const coverFactor = frameSize / Math.min(image.width, image.height);
    return {
      baseW: image.width * coverFactor,
      baseH: image.height * coverFactor,
    };
  }, [image, frameSize]);

  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 제스처 도중 동기적으로 읽고 쓰기 위한 숫자 미러
  const g = useRef({
    tx: 0,
    ty: 0,
    scale: 1,
    mode: null as null | 'pan' | 'pinch',
    panStartX: 0,
    panStartY: 0,
    panStartTx: 0,
    panStartTy: 0,
    pinchStartDist: 0,
    pinchStartScale: 1,
  }).current;

  const resetGesture = useCallback(() => {
    g.tx = 0;
    g.ty = 0;
    g.scale = 1;
    g.mode = null;
    translate.setValue({ x: 0, y: 0 });
    scaleAnim.setValue(1);
  }, [g, translate, scaleAnim]);

  const clampTranslate = useCallback(() => {
    if (!layout) return;
    const displayW = layout.baseW * g.scale;
    const displayH = layout.baseH * g.scale;
    const maxTx = Math.max(0, (displayW - frameSize) / 2);
    const maxTy = Math.max(0, (displayH - frameSize) / 2);
    g.tx = clamp(g.tx, -maxTx, maxTx);
    g.ty = clamp(g.ty, -maxTy, maxTy);
    translate.setValue({ x: g.tx, y: g.ty });
  }, [g, layout, frameSize, translate]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          g.mode = null;
        },
        onPanResponderMove: (evt) => {
          if (!layout) return;
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            const [a, b] = touches;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (g.mode !== 'pinch') {
              g.mode = 'pinch';
              g.pinchStartDist = dist || 1;
              g.pinchStartScale = g.scale;
            }
            const next = clamp(
              g.pinchStartScale * (dist / g.pinchStartDist),
              1,
              4,
            );
            g.scale = next;
            scaleAnim.setValue(next);
            clampTranslate();
          } else if (touches.length === 1) {
            const t = touches[0];
            if (g.mode !== 'pan') {
              g.mode = 'pan';
              g.panStartX = t.pageX;
              g.panStartY = t.pageY;
              g.panStartTx = g.tx;
              g.panStartTy = g.ty;
            }
            g.tx = g.panStartTx + (t.pageX - g.panStartX);
            g.ty = g.panStartTy + (t.pageY - g.panStartY);
            clampTranslate();
          }
        },
        onPanResponderRelease: () => {
          g.mode = null;
        },
        onPanResponderTerminate: () => {
          g.mode = null;
        },
      }),
    [g, layout, scaleAnim, clampTranslate],
  );

  const handleConfirm = useCallback(async () => {
    if (!image || !layout) return;
    setBusy(true);
    try {
      const displayW = layout.baseW * g.scale;
      const displayH = layout.baseH * g.scale;
      const d2oX = image.width / displayW;
      const d2oY = image.height / displayH;

      const cropW = clamp(frameSize * d2oX, 1, image.width);
      const cropH = clamp(frameSize * d2oY, 1, image.height);
      const originX = clamp(
        (displayW / 2 - frameSize / 2 - g.tx) * d2oX,
        0,
        image.width - cropW,
      );
      const originY = clamp(
        (displayH / 2 - frameSize / 2 - g.ty) * d2oY,
        0,
        image.height - cropH,
      );

      const context = ImageManipulator.manipulate(image.uri);
      context.crop({
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(cropW),
        height: Math.round(cropH),
      });
      context.resize({ width: 512 });
      const ref = await context.renderAsync();
      const result = await ref.saveAsync({
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      onCropped(result.uri);
    } finally {
      setBusy(false);
    }
  }, [image, layout, g, frameSize, onCropped]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={resetGesture}
    >
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>프로필 사진 위치 조정</Text>
            <Text style={styles.subtitle}>
              사진을 드래그하고 손가락으로 확대해 정사각형 안에 맞추세요
            </Text>
          </View>

          <View
            style={[styles.frame, { width: frameSize, height: frameSize }]}
            {...panResponder.panHandlers}
          >
            {image && layout ? (
              <Animated.Image
                source={{ uri: image.uri }}
                style={{
                  position: 'absolute',
                  left: (frameSize - layout.baseW) / 2,
                  top: (frameSize - layout.baseH) / 2,
                  width: layout.baseW,
                  height: layout.baseH,
                  transform: [
                    { translateX: translate.x },
                    { translateY: translate.y },
                    { scale: scaleAnim },
                  ],
                }}
              />
            ) : null}
            <View pointerEvents="none" style={styles.frameBorder} />
            {busy ? (
              <View style={styles.busyOverlay} pointerEvents="none">
                <ActivityIndicator color={theme.starGold} />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="outline"
                fullWidth
                disabled={busy}
                onPress={onCancel}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="완료"
                fullWidth
                disabled={busy || !layout}
                onPress={() => void handleConfirm()}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 20,
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
});

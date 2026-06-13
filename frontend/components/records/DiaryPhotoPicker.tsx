/**
 * 일기 사진 첨부 — 마이페이지 ImagePicker 패턴 재사용, 다중 선택
 */

import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import {
  prepareImageForUpload,
  UPLOAD_IMAGE_FORMAT_ERROR,
} from '../../lib/prepare-upload-image';
import { AppPressable } from '../ui/AppPressable';

export interface LocalDiaryPhoto {
  uri: string;
  mimeType: string;
}

interface DiaryPhotoPickerProps {
  photos: LocalDiaryPhoto[];
  onChange: (photos: LocalDiaryPhoto[]) => void;
  disabled?: boolean;
  error?: string | null;
}

export function DiaryPhotoPicker({
  photos,
  onChange,
  disabled = false,
  error = null,
}: DiaryPhotoPickerProps) {
  const { theme } = useTheme();
  const [pickError, setPickError] = useState<string | null>(null);

  const pickPhotos = useCallback(async () => {
    if (disabled) return;
    setPickError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });
    if (result.canceled || !result.assets.length) return;

    const next: LocalDiaryPhoto[] = [];
    let failed = 0;
    for (const asset of result.assets) {
      try {
        const prepared = await prepareImageForUpload(
          asset.uri,
          asset.mimeType,
          asset.fileName ?? null,
        );
        next.push(prepared);
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      setPickError(UPLOAD_IMAGE_FORMAT_ERROR);
    }
    if (next.length === 0) return;

    onChange([...photos, ...next].slice(0, 10));
  }, [disabled, onChange, photos]);

  const removeAt = useCallback(
    (index: number) => {
      onChange(photos.filter((_, i) => i !== index));
    },
    [onChange, photos],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.foreground }]}>사진 첨부</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <AppPressable
          onPress={() => void pickPhotos()}
          disabled={disabled || photos.length >= 10}
          style={({ pressed }) => [
            styles.addBtn,
            {
              borderColor: theme.cardBorder,
              backgroundColor: theme.inputBackground,
              opacity: disabled || photos.length >= 10 ? 0.45 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityLabel="사진 추가"
        >
          <Feather name="plus" size={22} color={theme.primaryGlow} />
        </AppPressable>

        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
            <AppPressable
              onPress={() => removeAt(index)}
              disabled={disabled}
              style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
              accessibilityLabel="사진 제거"
            >
              <Feather name="x" size={12} color="#fff" />
            </AppPressable>
          </View>
        ))}
      </ScrollView>
      <Text style={[styles.hint, { color: theme.mutedForeground }]}>
        최대 10장 · {photos.length}장 선택됨
      </Text>
      {pickError || error ? (
        <Text style={[styles.error, { color: theme.destructive }]}>
          {pickError ?? error}
        </Text>
      ) : null}
    </View>
  );
}

const THUMB = 72;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  addBtn: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 11 },
  error: { fontSize: 12 },
});

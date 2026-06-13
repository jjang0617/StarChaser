import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseScoreInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampScore(n);
}

interface CorrectionScoreInputProps {
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
}

export function CorrectionScoreInput({
  value,
  onChange,
  disabled = false,
}: CorrectionScoreInputProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(String(value));
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const draggingRef = useRef(false);
  const lastAppliedRef = useRef(value);

  useEffect(() => {
    setDraft(String(value));
    lastAppliedRef.current = value;
  }, [value]);

  const commitDraft = useCallback(
    (raw: string) => {
      const parsed = parseScoreInput(raw);
      if (parsed == null) {
        setDraft(String(value));
        return;
      }
      onChange(parsed);
      setDraft(String(parsed));
      lastAppliedRef.current = parsed;
    },
    [onChange, value],
  );

  const fillPct = useMemo(() => clampScore(value), [value]);

  const syncTrackMetrics = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) {
        trackPageXRef.current = x;
        trackWidthRef.current = width;
      }
    });
  }, []);

  const applyScoreFromPageX = useCallback(
    (pageX: number) => {
      const w = trackWidthRef.current;
      if (w <= 0) return;
      const x = pageX - trackPageXRef.current;
      const ratio = Math.min(1, Math.max(0, x / w));
      const next = clampScore(ratio * 100);
      if (next === lastAppliedRef.current) return;
      lastAppliedRef.current = next;
      onChange(next);
      setDraft(String(next));
    },
    [onChange],
  );

  const onTrackGrant = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      draggingRef.current = true;
      syncTrackMetrics();
      applyScoreFromPageX(e.nativeEvent.pageX);
    },
    [applyScoreFromPageX, disabled, syncTrackMetrics],
  );

  const onTrackMove = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled || !draggingRef.current) return;
      applyScoreFromPageX(e.nativeEvent.pageX);
    },
    [applyScoreFromPageX, disabled],
  );

  const onTrackRelease = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.scoreBox,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => commitDraft(draft)}
          onSubmitEditing={() => commitDraft(draft)}
          keyboardType="number-pad"
          maxLength={3}
          editable={!disabled}
          selectTextOnFocus
          style={[
            styles.scoreInput,
            {
              color: theme.foreground,
              fontFamily: 'SpaceMono-Regular',
            },
          ]}
          accessibilityLabel="제보할 Star-Index 점수"
        />
        <Text style={[styles.scoreUnit, { color: theme.mutedForeground }]}>/ 100</Text>
      </View>

      <View
        ref={trackRef}
        style={[styles.trackHit, disabled && styles.trackDisabled]}
        onLayout={() => {
          syncTrackMetrics();
        }}
        onStartShouldSetResponderCapture={() => !disabled}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => draggingRef.current}
        onResponderTerminationRequest={() => !draggingRef.current}
        onResponderGrant={onTrackGrant}
        onResponderMove={onTrackMove}
        onResponderRelease={onTrackRelease}
        onResponderTerminate={onTrackRelease}
        accessibilityRole="adjustable"
        accessibilityLabel="점수 슬라이더"
        accessibilityValue={{ min: 0, max: 100, now: fillPct }}
      >
        <View style={[styles.track, { backgroundColor: theme.borderSubtle }]} pointerEvents="none">
          <View
            style={[
              styles.trackFill,
              {
                width: `${fillPct}%`,
                backgroundColor: theme.primaryGlow,
              },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: `${fillPct}%`,
              backgroundColor: theme.primaryGlow,
              borderColor: theme.background,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  scoreInput: {
    fontSize: 40,
    fontWeight: '300',
    minWidth: 72,
    textAlign: 'center',
    padding: 0,
  },
  scoreUnit: {
    fontSize: 16,
    marginTop: 12,
  },
  trackHit: {
    paddingVertical: 14,
    justifyContent: 'center',
  },
  trackDisabled: {
    opacity: 0.45,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    top: '50%',
    marginTop: -9,
    borderWidth: 2,
  },
});

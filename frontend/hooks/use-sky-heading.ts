import * as Location from 'expo-location';
import { Gyroscope } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  COMPASS_BLEND_MOTION,
  GYRO_YAW_GAIN,
  HEADING_MAX_SAMPLE_DT_SEC,
  HEADING_SMOOTH_TAU_SEC,
  lerpAngleDeg,
  normYaw,
  smoothHeadingToward,
} from '../components/sky/sky-tab-constants';

export function useSkyHeading(options: {
  alignHeading: boolean;
  motionAssist: boolean;
  locationFeaturesEnabled: boolean;
}) {
  const { alignHeading, motionAssist, locationFeaturesEnabled } = options;

  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [headingErr, setHeadingErr] = useState<string | null>(null);
  const headingSmoothRef = useRef<number | null>(null);
  const fusedHeadingRef = useRef<number | null>(null);
  const lastGyroAtRef = useRef<number>(Date.now());
  const lastHeadingSampleAtRef = useRef<number>(Date.now());
  const prevMotionAssistRef = useRef(false);

  useEffect(() => {
    const wasMotion = prevMotionAssistRef.current;
    if (!motionAssist) {
      fusedHeadingRef.current = null;
      if (wasMotion && headingDeg != null) {
        headingSmoothRef.current = headingDeg;
      }
    } else if (!wasMotion && headingDeg != null) {
      fusedHeadingRef.current = headingDeg;
    }
    prevMotionAssistRef.current = motionAssist;
  }, [motionAssist, headingDeg]);

  useEffect(() => {
    if (!alignHeading || Platform.OS === 'web' || !locationFeaturesEnabled) {
      return;
    }
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    headingSmoothRef.current = null;
    lastHeadingSampleAtRef.current = Date.now();
    setHeadingErr(null);

    void (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        sub = await Location.watchHeadingAsync((h) => {
          const raw = normYaw(
            h.trueHeading >= 0 ? h.trueHeading : h.magHeading,
          );
          const now = Date.now();
          const dt = (now - lastHeadingSampleAtRef.current) / 1000;
          lastHeadingSampleAtRef.current = now;

          if (motionAssist) {
            const prevFused = fusedHeadingRef.current;
            const fused =
              prevFused == null
                ? raw
                : lerpAngleDeg(prevFused, raw, COMPASS_BLEND_MOTION);
            fusedHeadingRef.current = fused;
            const display = smoothHeadingToward(
              headingSmoothRef.current,
              fused,
              dt,
            );
            headingSmoothRef.current = display;
            setHeadingDeg(display);
          } else {
            const display = smoothHeadingToward(
              headingSmoothRef.current,
              raw,
              dt,
            );
            headingSmoothRef.current = display;
            setHeadingDeg(display);
          }
        });
      } catch {
        if (!cancelled) setHeadingErr('나침반을 쓸 수 없습니다. 위치 권한·기기를 확인해 주세요.');
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [alignHeading, motionAssist, locationFeaturesEnabled]);

  useEffect(() => {
    if (!alignHeading || !motionAssist || Platform.OS === 'web') {
      return;
    }
    lastGyroAtRef.current = Date.now();
    Gyroscope.setUpdateInterval(Platform.OS === 'android' ? 160 : 72);
    const sub = Gyroscope.addListener((e) => {
      const now = Date.now();
      const dt = Math.min(
        HEADING_MAX_SAMPLE_DT_SEC,
        (now - lastGyroAtRef.current) / 1000,
      );
      lastGyroAtRef.current = now;
      if (fusedHeadingRef.current == null) return;
      const deltaDeg = ((-e.z * dt * 180) / Math.PI) * GYRO_YAW_GAIN;
      fusedHeadingRef.current = normYaw(fusedHeadingRef.current + deltaDeg);
      const display = smoothHeadingToward(
        headingSmoothRef.current,
        fusedHeadingRef.current,
        dt,
        HEADING_SMOOTH_TAU_SEC * 0.9,
      );
      headingSmoothRef.current = display;
      setHeadingDeg(display);
    });
    return () => sub.remove();
  }, [alignHeading, motionAssist]);

  return { headingDeg, headingErr };
}

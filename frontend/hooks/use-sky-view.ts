import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import {
  ApiRequestError,
  fetchSkyView,
  SessionExpiredError,
  type SkyViewResponseDto,
} from '../lib/api-client';
import { sanitizeApiErrorMessage } from '../lib/sanitize-api-error';
import {
  clampNum,
  normYaw,
  VIEW_ALT_MAX,
  VIEW_ALT_MIN,
  VIEW_DEFAULT_PITCH,
  VIEW_DEFAULT_YAW,
  VIEW_PITCH_GAIN,
  VIEW_YAW_GAIN,
} from '../components/sky/sky-tab-constants';

export function useSkyView(options: {
  obsLat: number | null;
  obsLng: number | null;
  observeAtIso: string;
  onSessionInvalidated: () => Promise<void>;
}) {
  const { obsLat, obsLng, observeAtIso, onSessionInvalidated } = options;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SkyViewResponseDto | null>(null);
  const [viewYawDeg, setViewYawDeg] = useState(VIEW_DEFAULT_YAW);
  const [viewPitchDeg, setViewPitchDeg] = useState(VIEW_DEFAULT_PITCH);

  const load = useCallback(async () => {
    if (obsLat == null || obsLng == null) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const v = await fetchSkyView({
        lat: obsLat,
        lng: obsLng,
        at: observeAtIso,
      });
      setData(v);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setErr(sanitizeApiErrorMessage(e.status, e.message));
      } else {
        setErr('천구 데이터를 불러오지 못했습니다.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [obsLat, obsLng, observeAtIso, onSessionInvalidated]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setViewYawDeg(VIEW_DEFAULT_YAW);
    setViewPitchDeg(VIEW_DEFAULT_PITCH);
  }, [obsLat, obsLng]);

  const skyPanLast = useRef<{ x: number; y: number } | null>(null);
  const skyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          data != null && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
        onPanResponderGrant: (e) => {
          skyPanLast.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
        },
        onPanResponderMove: (e) => {
          if (skyPanLast.current == null) return;
          const x = e.nativeEvent.pageX;
          const y = e.nativeEvent.pageY;
          const dx = x - skyPanLast.current.x;
          const dy = y - skyPanLast.current.y;
          skyPanLast.current = { x, y };
          // 가로: 손가락 방향으로 둘러보기(왼쪽으로 끌면 오른쪽 별이 왼쪽으로 이동)
          setViewYawDeg((deg) => normYaw(deg - dx * VIEW_YAW_GAIN));
          // 세로: 아래로 끌면 더 위를 올려다봄(고도↑). 0°(지평선)~90°(천정)로 제한
          setViewPitchDeg((deg) =>
            clampNum(deg + dy * VIEW_PITCH_GAIN, VIEW_ALT_MIN, VIEW_ALT_MAX),
          );
        },
        onPanResponderRelease: () => {
          skyPanLast.current = null;
        },
        onPanResponderTerminate: () => {
          skyPanLast.current = null;
        },
      }),
    [data],
  );

  const resetView = useCallback(() => {
    setViewYawDeg(VIEW_DEFAULT_YAW);
    setViewPitchDeg(VIEW_DEFAULT_PITCH);
  }, []);

  return {
    data,
    loading,
    err,
    load,
    viewYawDeg,
    viewPitchDeg,
    setViewYawDeg,
    setViewPitchDeg,
    skyPanResponder,
    resetView,
  };
}

import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { PermissionResponse } from 'expo-location';

export type ObserverLocationUnavailable = 'permission' | 'app-disabled';
import {
  ApiRequestError,
  fetchStarIndex,
  fetchStarIndexAtLocation,
  SessionExpiredError,
} from '../api-client';
import type { StarIndexResponseDto } from '../types/api';
import { starIndexLoadErrorMessage } from '../star-index-stale';
import {
  coordsChangedEnough,
  hasFiniteCoords,
} from './coords';
import {
  loadLocalStarIndexCache,
  saveLocalStarIndexCache,
} from './local-cache';
import { resolveObserverPlaceLabel } from './resolve-place-label';

export function useObserverStarIndex({
  activeSpotId,
  observerLat,
  observerLng,
  useDeviceLocation,
  locationPrefLoaded = true,
  locationEnabled = false,
  locationPermissionStatus = null,
  onSessionInvalidated,
}: {
  activeSpotId: string | null;
  observerLat?: number | null;
  observerLng?: number | null;
  useDeviceLocation?: boolean;
  locationPrefLoaded?: boolean;
  locationEnabled?: boolean;
  locationPermissionStatus?: PermissionResponse['status'] | null;
  onSessionInvalidated: () => Promise<void>;
}) {
  const [data, setData] = useState<StarIndexResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [fromGps, setFromGps] = useState(false);
  const [resolvedPermissionStatus, setResolvedPermissionStatus] = useState<
    PermissionResponse['status'] | null
  >(locationPermissionStatus ?? null);
  const resolvedPermissionRef = useRef(resolvedPermissionStatus);
  resolvedPermissionRef.current = resolvedPermissionStatus;
  const reloadSeqRef = useRef(0);
  const lastFetchedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const dataRef = useRef<StarIndexResponseDto | null>(null);
  const reloadFnRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(
    null,
  );

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (locationPermissionStatus != null) {
      setResolvedPermissionStatus((prev) =>
        prev === locationPermissionStatus ? prev : locationPermissionStatus,
      );
    }
  }, [locationPermissionStatus]);

  const observerCoordsReady = hasFiniteCoords(observerLat, observerLng);
  const permissionDenied =
    resolvedPermissionStatus === Location.PermissionStatus.DENIED;
  const gpsPermissionBlocked =
    permissionDenied ||
    (locationEnabled &&
      resolvedPermissionStatus != null &&
      resolvedPermissionStatus !== Location.PermissionStatus.GRANTED);

  const locationUnavailable = useMemo((): ObserverLocationUnavailable | null => {
    if (Platform.OS === 'web' || observerCoordsReady || !locationPrefLoaded) {
      return null;
    }
    if (gpsPermissionBlocked) return 'permission';
    if (!locationEnabled) return 'app-disabled';
    return null;
  }, [
    observerCoordsReady,
    locationPrefLoaded,
    gpsPermissionBlocked,
    locationEnabled,
  ]);

  const awaitingLocation =
    !locationPrefLoaded ||
    (locationEnabled &&
      useDeviceLocation &&
      !observerCoordsReady &&
      !gpsPermissionBlocked);

  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const reload = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    const silent = opts?.silent ?? false;
    const force = opts?.force ?? false;
    const seq = ++reloadSeqRef.current;
    const isLatest = () => reloadSeqRef.current === seq;
    const applyLoading = (value: boolean) => {
      if (!isLatest()) return;
      if (force && dataRef.current) {
        setManualRefreshing(value);
        return;
      }
      setLoading(value);
    };
    if (force && isLatest()) {
      setManualRefreshing(true);
      setRefreshFeedback(null);
    }
    let lat: number | undefined;
    let lng: number | undefined;
    let permStatus = locationPermissionStatus ?? resolvedPermissionRef.current;

    if (Platform.OS !== 'web') {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        permStatus = perm.status;
        setResolvedPermissionStatus((prev) =>
          prev === perm.status ? prev : perm.status,
        );
      } catch {
        /* prop/캐시 상태 유지 */
      }
    }

    const reloadPermissionDenied =
      permStatus === Location.PermissionStatus.DENIED;
    const reloadGpsBlocked =
      reloadPermissionDenied ||
      (locationEnabled &&
        permStatus != null &&
        permStatus !== Location.PermissionStatus.GRANTED);

    if (locationEnabled && hasFiniteCoords(observerLat, observerLng)) {
      lat = observerLat!;
      lng = observerLng!;
    } else if (useDeviceLocation && Platform.OS !== 'web') {
      try {
        if (permStatus === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        /* watch/lastKnown 좌표만 사용 */
      }
    }

    if (!locationEnabled) {
      lat = undefined;
      lng = undefined;
    }

    const hasCoords = hasFiniteCoords(lat, lng);

    const finishManualRefresh = (feedback?: { tone: 'success' | 'error'; message: string }) => {
      if (!force || !isLatest()) return;
      setManualRefreshing(false);
      if (feedback) setRefreshFeedback(feedback);
    };

    if (!locationPrefLoaded) {
      if (!silent && isLatest()) {
        applyLoading(true);
        setError(null);
      }
      if (force) {
        finishManualRefresh({
          tone: 'error',
          message: '설정을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.',
        });
      }
      return;
    }

    if (locationEnabled && !hasCoords && reloadGpsBlocked) {
      if (!isLatest()) return;
      if (force) {
        finishManualRefresh({
          tone: 'error',
          message: '위치 권한이 필요해요. 마이페이지 또는 시스템 설정을 확인해 주세요.',
        });
        return;
      }
      setData(null);
      setError(null);
      setPlaceLabel(null);
      setFromGps(false);
      applyLoading(false);
      return;
    }

    if (
      Platform.OS !== 'web' &&
      !hasCoords &&
      (!locationEnabled || reloadGpsBlocked)
    ) {
      if (!isLatest()) return;
      if (force && !locationEnabled) {
        finishManualRefresh({
          tone: 'error',
          message: '마이페이지(ME)에서 위치 사용을 켜 주세요.',
        });
        return;
      }
      if (force && reloadGpsBlocked) {
        finishManualRefresh({
          tone: 'error',
          message: '위치 권한이 필요해요. 마이페이지 또는 시스템 설정을 확인해 주세요.',
        });
        return;
      }
      setData(null);
      setError(null);
      setPlaceLabel(null);
      setFromGps(false);
      applyLoading(false);
      return;
    }

    if (
      locationEnabled &&
      useDeviceLocation &&
      !hasCoords &&
      !reloadPermissionDenied
    ) {
      if (!silent && isLatest()) {
        applyLoading(true);
        setError(null);
      }
      if (force) {
        finishManualRefresh({
          tone: 'error',
          message: '현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
        });
      }
      return;
    }

    if (!hasCoords && !activeSpotId) {
      if (!isLatest()) return;
      if (force) {
        finishManualRefresh({
          tone: 'error',
          message: '측정할 위치를 찾지 못했어요.',
        });
        return;
      }
      setData(null);
      setError(null);
      setPlaceLabel(null);
      setFromGps(false);
      applyLoading(false);
      return;
    }

    if (
      !force &&
      hasCoords &&
      !coordsChangedEnough(lastFetchedCoordsRef.current, lat!, lng!) &&
      dataRef.current
    ) {
      applyLoading(false);
      return;
    }

    let revalidateSilent = silent;

    if (hasCoords && !force) {
      const cached = await loadLocalStarIndexCache(lat!, lng!);
      if (cached && isLatest()) {
        setData(cached.data);
        setFromGps(true);
        setError(null);
        if (cached.placeLabel) {
          setPlaceLabel(cached.placeLabel);
        }
        lastFetchedCoordsRef.current = { lat: lat!, lng: lng! };
        applyLoading(false);
        revalidateSilent = true;
      } else if (!silent && isLatest()) {
        applyLoading(true);
        setError(null);
      }
    } else if ((!silent || force) && isLatest()) {
      applyLoading(true);
      setError(null);
    }

    try {
      if (hasCoords) {
        const d = await fetchStarIndexAtLocation(lat!, lng!);
        if (!isLatest()) return;
        setData(d);
        setFromGps(true);
        lastFetchedCoordsRef.current = { lat: lat!, lng: lng! };
        void saveLocalStarIndexCache(lat!, lng!, d, null);
        resolveObserverPlaceLabel(lat!, lng!, isLatest, setPlaceLabel, (label) => {
          void saveLocalStarIndexCache(lat!, lng!, d, label);
        });
        if (force) {
          setLastRefreshedAt(Date.now());
          finishManualRefresh({ tone: 'success', message: '방금 갱신됨' });
        }
        return;
      }

      setFromGps(false);
      setPlaceLabel(null);
      const d = await fetchStarIndex(activeSpotId!);
      if (!isLatest()) return;
      setData(d);
      if (force) {
        setLastRefreshedAt(Date.now());
        finishManualRefresh({ tone: 'success', message: '방금 갱신됨' });
      }
    } catch (e) {
      if (!isLatest()) return;
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        if (force) finishManualRefresh();
        return;
      }
      if (revalidateSilent && dataRef.current && !force) {
        return;
      }
      const errMsg =
        e instanceof ApiRequestError
          ? starIndexLoadErrorMessage(e)
          : 'Star-Index를 불러오지 못했습니다.';
      if (force && dataRef.current) {
        finishManualRefresh({
          tone: 'error',
          message: '갱신에 실패했어요. 다시 시도해주세요.',
        });
        return;
      }
      setError(errMsg);
      setData(null);
      setPlaceLabel(null);
      setFromGps(false);
    } finally {
      if (force) {
        if (isLatest()) setManualRefreshing(false);
      } else if (!revalidateSilent || !dataRef.current) {
        applyLoading(false);
      }
    }
  }, [
    activeSpotId,
    observerLat,
    observerLng,
    useDeviceLocation,
    locationPrefLoaded,
    locationEnabled,
    locationPermissionStatus,
    onSessionInvalidated,
  ]);

  reloadFnRef.current = reload;

  useEffect(() => {
    if (refreshFeedback?.tone !== 'success') return;
    const timer = setTimeout(() => {
      setRefreshFeedback((prev) => (prev?.tone === 'success' ? null : prev));
    }, 3000);
    return () => clearTimeout(timer);
  }, [refreshFeedback]);

  useEffect(() => {
    void reloadFnRef.current?.();
  }, [
    reload,
    activeSpotId,
    locationPrefLoaded,
    locationEnabled,
    useDeviceLocation,
    locationPermissionStatus,
  ]);

  useEffect(() => {
    if (!observerCoordsReady) return;
    const timer = setTimeout(() => {
      void reloadFnRef.current?.();
    }, 350);
    return () => clearTimeout(timer);
  }, [observerLat, observerLng, observerCoordsReady]);

  useEffect(() => {
    if (locationEnabled || !fromGps) return;
    setData(null);
    setFromGps(false);
    setPlaceLabel(null);
    setError(null);
  }, [locationEnabled, fromGps]);

  useEffect(() => {
    if (!locationUnavailable || observerCoordsReady) return;
    setData(null);
    setFromGps(false);
    setPlaceLabel(null);
    setError(null);
    setLoading(false);
  }, [locationUnavailable, observerCoordsReady]);

  useEffect(() => {
    if (!error || data || loading || awaitingLocation || locationUnavailable) {
      return;
    }
    const timer = setTimeout(() => void reload({ silent: true }), 2500);
    return () => clearTimeout(timer);
  }, [
    error,
    data,
    loading,
    awaitingLocation,
    locationUnavailable,
    reload,
  ]);

  const resolveSpotIdForSave = useCallback((): string | undefined => {
    if (!data) return undefined;
    if (fromGps) return undefined;
    if (data.spotId && data.spotId.length > 0) return data.spotId;
    return activeSpotId ?? undefined;
  }, [activeSpotId, data, fromGps]);

  return {
    data,
    loading,
    error,
    placeLabel,
    fromGps,
    awaitingLocation,
    locationUnavailable,
    manualRefreshing,
    lastRefreshedAt,
    refreshFeedback,
    reload,
    resolveSpotIdForSave,
  };
}

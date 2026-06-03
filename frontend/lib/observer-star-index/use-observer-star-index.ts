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

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const seq = ++reloadSeqRef.current;
    const isLatest = () => reloadSeqRef.current === seq;
    const applyLoading = (value: boolean) => {
      if (isLatest()) setLoading(value);
    };
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

    if (!locationPrefLoaded) {
      if (!silent && isLatest()) {
        applyLoading(true);
        setError(null);
      }
      return;
    }

    if (locationEnabled && !hasCoords && reloadGpsBlocked) {
      if (!isLatest()) return;
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
      return;
    }

    if (!hasCoords && !activeSpotId) {
      if (!isLatest()) return;
      setData(null);
      setError(null);
      setPlaceLabel(null);
      setFromGps(false);
      applyLoading(false);
      return;
    }

    if (
      hasCoords &&
      !coordsChangedEnough(lastFetchedCoordsRef.current, lat!, lng!) &&
      dataRef.current
    ) {
      applyLoading(false);
      return;
    }

    let revalidateSilent = silent;

    if (hasCoords) {
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
    } else if (!silent && isLatest()) {
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
        return;
      }

      setFromGps(false);
      setPlaceLabel(null);
      const d = await fetchStarIndex(activeSpotId!);
      if (!isLatest()) return;
      setData(d);
    } catch (e) {
      if (!isLatest()) return;
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (revalidateSilent && dataRef.current) {
        return;
      }
      if (e instanceof ApiRequestError) {
        setError(starIndexLoadErrorMessage(e));
      } else {
        setError('Star-Index를 불러오지 못했습니다.');
      }
      setData(null);
      setPlaceLabel(null);
      setFromGps(false);
    } finally {
      if (!revalidateSilent || !dataRef.current) {
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
    reload,
    resolveSpotIdForSave,
  };
}

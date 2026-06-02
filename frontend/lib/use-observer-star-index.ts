import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { PermissionResponse } from 'expo-location';
import {
  ApiRequestError,
  fetchStarIndex,
  fetchStarIndexAtLocation,
  SessionExpiredError,
} from './api-client';
import type { StarIndexResponseDto } from './types/api';
import { placeLabelFromReverseGeocode } from './observer-place-label';
import { starIndexLoadErrorMessage } from './star-index-stale';

function hasFiniteCoords(lat?: number | null, lng?: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

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

  const observerCoordsReady = hasFiniteCoords(observerLat, observerLng);
  const permissionDenied =
    locationPermissionStatus === Location.PermissionStatus.DENIED;

  /** GPS 좌표가 올 때까지 spotId 폴백으로 조기 요청하지 않음 */
  const awaitingLocation =
    !locationPrefLoaded ||
    (locationEnabled &&
      useDeviceLocation &&
      !observerCoordsReady &&
      !permissionDenied);

  const reload = useCallback(async () => {
    let lat: number | undefined;
    let lng: number | undefined;

    if (useDeviceLocation && Platform.OS !== 'web') {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        /* observer 좌표 폴백 */
      }
    }

    if (
      (lat == null ||
        lng == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)) &&
      observerLat != null &&
      observerLng != null
    ) {
      lat = observerLat;
      lng = observerLng;
    }

    const hasCoords = hasFiniteCoords(lat, lng);

    if (!locationPrefLoaded) {
      setLoading(true);
      setError(null);
      return;
    }

    if (
      locationEnabled &&
      useDeviceLocation &&
      !hasCoords &&
      !permissionDenied
    ) {
      setLoading(true);
      setError(null);
      return;
    }

    if (!hasCoords && !activeSpotId) {
      setData(null);
      setError(null);
      setPlaceLabel(null);
      setFromGps(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (hasCoords) {
        const d = await fetchStarIndexAtLocation(lat!, lng!);
        setData(d);
        setFromGps(true);
        try {
          if (Platform.OS !== 'web') {
            const geo = await Location.reverseGeocodeAsync({
              latitude: lat!,
              longitude: lng!,
            });
            const a = geo[0];
            if (a) {
              const label = placeLabelFromReverseGeocode(a);
              setPlaceLabel(
                label || `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`,
              );
            } else {
              setPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
            }
          } else {
            setPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
          }
        } catch {
          setPlaceLabel(`${lat!.toFixed(4)}, ${lng!.toFixed(4)}`);
        }
        return;
      }

      setFromGps(false);
      setPlaceLabel(null);
      const d = await fetchStarIndex(activeSpotId!);
      setData(d);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
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
      setLoading(false);
    }
  }, [
    activeSpotId,
    observerLat,
    observerLng,
    useDeviceLocation,
    locationPrefLoaded,
    locationEnabled,
    locationPermissionStatus,
    permissionDenied,
    onSessionInvalidated,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 일시 오류 시 MAIN에서 측정 중 UI 유지 — 백그라운드 재시도 */
  useEffect(() => {
    if (!error || data || loading || awaitingLocation) return;
    const timer = setTimeout(() => void reload(), 2500);
    return () => clearTimeout(timer);
  }, [error, data, loading, awaitingLocation, reload]);

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
    reload,
    resolveSpotIdForSave,
  };
}

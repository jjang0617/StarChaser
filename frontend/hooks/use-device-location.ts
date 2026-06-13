import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  loadLocationEnabled,
  saveLocationEnabled,
} from '../lib/location-preferences';
import { hasFiniteCoords } from '../lib/observer-star-index/coords';

export function useDeviceLocationState(userId: string | undefined) {
  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLng, setDeviceLng] = useState<number | null>(null);
  const [foregroundLocationStatus, setForegroundLocationStatus] =
    useState<Location.PermissionResponse['status'] | null>(null);
  const [locationEnabledPref, setLocationEnabledPref] = useState(false);
  const [locationPrefLoaded, setLocationPrefLoaded] = useState(false);
  const [locationToggleBusy, setLocationToggleBusy] = useState(false);

  const refreshForegroundLocationStatus = useCallback(async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    setForegroundLocationStatus(existing.status);
    return existing.status;
  }, []);

  useEffect(() => {
    void refreshForegroundLocationStatus();
  }, [refreshForegroundLocationStatus]);

  useEffect(() => {
    if (!userId) {
      setLocationPrefLoaded(false);
      return;
    }
    let mounted = true;
    void (async () => {
      const enabled = await loadLocationEnabled(userId);
      if (!mounted) return;
      setLocationEnabledPref(enabled);
      setLocationPrefLoaded(true);
      if (!enabled) {
        setDeviceLat(null);
        setDeviceLng(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshForegroundLocationStatus();
    });
    return () => sub.remove();
  }, [refreshForegroundLocationStatus]);

  const deviceLocationActive =
    locationPrefLoaded &&
    locationEnabledPref &&
    foregroundLocationStatus === Location.PermissionStatus.GRANTED;

  useEffect(() => {
    if (!deviceLocationActive) {
      if (!locationEnabledPref) {
        setDeviceLat(null);
        setDeviceLng(null);
      }
      return;
    }
    let sub: Location.LocationSubscription | undefined;
    let alive = true;
    void (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (alive && last) {
          setDeviceLat(last.coords.latitude);
          setDeviceLng(last.coords.longitude);
        }
      } catch {
        /* 단말에 캐시 없음 */
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (alive) {
          setDeviceLat(pos.coords.latitude);
          setDeviceLng(pos.coords.longitude);
        }
      } catch {
        /* watch에서 보정 */
      }
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 8000,
        },
        (loc) => {
          if (!alive) return;
          setDeviceLat(loc.coords.latitude);
          setDeviceLng(loc.coords.longitude);
        },
      );
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [deviceLocationActive, locationEnabledPref]);

  const requestLocationPermission = useCallback(async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    setForegroundLocationStatus(r.status);
    if (r.status === Location.PermissionStatus.GRANTED) {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDeviceLat(pos.coords.latitude);
        setDeviceLng(pos.coords.longitude);
      } catch {
        /* watch에서 보정 */
      }
    }
    return r.status;
  }, []);

  const handleLocationEnabledChange = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      setLocationToggleBusy(true);
      try {
        await saveLocationEnabled(userId, enabled);
        setLocationEnabledPref(enabled);
        if (!enabled) {
          setDeviceLat(null);
          setDeviceLng(null);
          return;
        }
        const status = await requestLocationPermission();
        if (status !== Location.PermissionStatus.GRANTED) {
          await refreshForegroundLocationStatus();
        }
      } finally {
        setLocationToggleBusy(false);
      }
    },
    [userId, requestLocationPermission, refreshForegroundLocationStatus],
  );

  const openLocationSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const hasObserverGps = hasFiniteCoords(deviceLat, deviceLng);

  return {
    deviceLat,
    deviceLng,
    foregroundLocationStatus,
    locationEnabledPref,
    locationPrefLoaded,
    locationToggleBusy,
    useDeviceLocation: deviceLocationActive,
    hasObserverGps,
    requestLocationPermission,
    handleLocationEnabledChange,
    openLocationSettings,
    refreshForegroundLocationStatus,
  };
}

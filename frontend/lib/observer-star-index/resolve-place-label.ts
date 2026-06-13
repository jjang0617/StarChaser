import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { placeLabelFromReverseGeocode } from '../observer-place-label';

/** 점수 표시와 분리 — 역지오코딩은 백그라운드 */
export function resolveObserverPlaceLabel(
  lat: number,
  lng: number,
  isLatest: () => boolean,
  setPlaceLabel: (label: string) => void,
  onResolved?: (label: string) => void,
): void {
  void (async () => {
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const commit = (label: string) => {
      if (!isLatest()) return;
      setPlaceLabel(label);
      onResolved?.(label);
    };
    try {
      if (Platform.OS !== 'web') {
        const geo = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (!isLatest()) return;
        const a = geo[0];
        if (a) {
          const label = placeLabelFromReverseGeocode(a);
          commit(label || fallback);
        } else {
          commit(fallback);
        }
      } else {
        commit(fallback);
      }
    } catch {
      commit(fallback);
    }
  })();
}

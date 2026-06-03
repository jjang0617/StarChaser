import { useCallback, useState } from 'react';
import { ApiRequestError, fetchStarIndex } from '../lib/api-client';
import { handleSessionExpired } from '../lib/api-error';
import { starIndexCardErrorFromApi } from '../lib/star-index-errors';
import type { StarIndexResponseDto } from '../lib/types/api';
import type { StatefulCardError } from '../components/ui';

export function useMapSpotStarIndex(
  onSessionInvalidated: () => void | Promise<void>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StatefulCardError | null>(null);
  const [data, setData] = useState<StarIndexResponseDto | null>(null);

  const load = useCallback(
    (spotId: string) => {
      setLoading(true);
      setError(null);
      setData(null);
      void (async () => {
        try {
          const row = await fetchStarIndex(spotId);
          setData(row);
        } catch (e) {
          if (await handleSessionExpired(e, onSessionInvalidated)) return;
          if (e instanceof ApiRequestError) {
            setError(starIndexCardErrorFromApi(e));
          } else {
            setError({
              cardDescription: '오류',
              isTransient: false,
              lines: ['Star-Index를 불러오지 못했습니다.'],
            });
          }
        } finally {
          setLoading(false);
        }
      })();
    },
    [onSessionInvalidated],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, load, reset };
}

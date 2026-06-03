import { useEffect, useState } from 'react';
import { apiErrorMessage, handleSessionExpired } from '../lib/api-error';
import { fetchWeeklyTop3 } from '../lib/api-client';
import type { WeeklyTop3ItemDto } from '../lib/types/api';

export function useWeeklyTop3(
  active: boolean,
  onSessionInvalidated: () => void | Promise<void>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WeeklyTop3ItemDto[] | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchWeeklyTop3();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (await handleSessionExpired(e, onSessionInvalidated)) {
          if (!cancelled) {
            setError('세션이 만료되었습니다. 다시 로그인해 주세요.');
          }
          return;
        }
        if (!cancelled) {
          setError(
            apiErrorMessage(e, '주간 TOP3를 불러오지 못했습니다.') ??
              '주간 TOP3를 불러오지 못했습니다.',
          );
          setItems(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, onSessionInvalidated]);

  return { loading, error, items };
}

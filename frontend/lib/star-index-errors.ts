import { ApiRequestError } from './api-client';
import type { StatefulCardError } from '../components/ui';

import { sanitizeApiErrorMessage } from './sanitize-api-error';

export function starIndexCardErrorFromApi(e: ApiRequestError): StatefulCardError {
  const line = sanitizeApiErrorMessage(e.status, e.message);
  if (e.status === 503) {
    return {
      cardDescription: '데이터 준비 중',
      isTransient: true,
      lines: [line],
    };
  }
  return {
    cardDescription: '오류',
    isTransient: false,
    lines: [line],
  };
}

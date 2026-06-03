import { ServiceUnavailableException } from '@nestjs/common';

export const STAR_INDEX_INPUT_CACHE_UNAVAILABLE =
  '실시간 기상 데이터를 준비 중입니다. 잠시 후 다시 시도해 주세요.';

export const STAR_INDEX_INPUT_CACHE_UNAVAILABLE_BATCH =
  '실시간 기상 데이터를 준비 중입니다. 잠시 후 다시 시도해 주세요.';

export function throwStarIndexInputCacheUnavailable(
  message = STAR_INDEX_INPUT_CACHE_UNAVAILABLE,
): never {
  throw new ServiceUnavailableException(message);
}

import { authorizedGetJson, authorizedPostJson } from './http';

export interface CorrectionAggregateDto {
  spotId: string;
  submissionCount: number;
}

export function fetchCorrectionAggregate(
  spotId: string,
): Promise<CorrectionAggregateDto> {
  const q = encodeURIComponent(spotId);
  return authorizedGetJson<CorrectionAggregateDto>(
    `/corrections/aggregate?spotId=${q}`,
  );
}

export interface CreateCorrectionPayload {
  spotId: string;
  perceivedQuality: number;
}

export interface CreateCorrectionResponseDto {
  id: string;
  spotId: string;
  perceivedQuality: number;
  createdAt: string;
  aggregatedCorrectionScore: number;
}

export function submitStarIndexCorrection(
  payload: CreateCorrectionPayload,
): Promise<CreateCorrectionResponseDto> {
  return authorizedPostJson<CreateCorrectionResponseDto>(
    '/corrections',
    payload,
  );
}

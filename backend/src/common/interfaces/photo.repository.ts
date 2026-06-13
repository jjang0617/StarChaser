// ──────────────────────────────────────────────────────────────
// PhotoRepository 인터페이스
// ──────────────────────────────────────────────────────────────

export interface Photo {
  id: string;
  observationId: string;
  imageUrl: string;
  caption: string | null;
  takenAt: Date | null;
}

export interface PhotoRepository {
  findByObservationIds(observationIds: string[]): Promise<Photo[]>;
  save(data: Omit<Photo, 'id'>): Promise<Photo>;
  deleteByObservationId(observationId: string): Promise<void>;
}

export const PHOTO_REPOSITORY = 'PHOTO_REPOSITORY';

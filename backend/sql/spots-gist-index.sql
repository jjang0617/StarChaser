-- spots.location 반경 검색(ST_DWithin) 성능 — GIST 인덱스 (없을 때만 실행)
-- Supabase: PostGIS 활성화 확인 후 SQL Editor에서 실행

CREATE INDEX IF NOT EXISTS idx_spots_location_gist ON spots USING GIST (location);

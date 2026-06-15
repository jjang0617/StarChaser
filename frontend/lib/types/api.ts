/** 백엔드 WeatherSnapshot(표시용 일부 필드) */
export interface WeatherSnapshotDto {
  cloud_score: number;
  pm25_score: number;
  light_pollution_score: number;
  moon_effect_score: number;
  humidity_score: number;
  elevation_score: number;
  wind_score: number;
  visibility_score: number;
  temperature_score: number;
  correction_score: number;
  precipitation_probability?: number;
  moon_altitude_deg?: number;
  moon_altitude_known?: boolean;
  lun_phase?: number;
  cloud_sky_code?: number;
  cloud_sky_label?: string;
  cloud_cover_pct?: number;
  pm25_ug_m3?: number;
  pm25_label?: string;
  pm25_station_name?: string;
  sun_altitude_deg?: number;
  daylight_observation_score?: number;
  precipitation_type?: number;
  precipitation_score?: number;
  visibility_known?: boolean;
}

export interface StarIndexCardDisplayDto {
  cloud: string;
  pm25: string;
}

export interface StarIndexResponseDto {
  /** 명소 기준이면 UUID · GPS 전용 응답이면 가장 가까운 명소 id 또는 생략 */
  spotId?: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  bortleClass: number;
  hasParking?: boolean | null;
  hasToilet?: boolean | null;
  score: number;
  weatherSnapshot: WeatherSnapshotDto;
  display?: StarIndexCardDisplayDto;
  cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
  message: string;
  requestedBy: string;
  /** 실시간 캐시 실패 시 직전 star_index:{spotId} 폴백 */
  isStale?: boolean;
  cachedAt?: string;
  source?: 'live' | 'stale_cache';
}

export interface UserProfileDto {
  id: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface AuthTokensResponseDto {
  user: UserProfileDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshAccessResponseDto {
  accessToken: string;
}

/** GET /spots · /spots/nearby 응답 한 줄 (Nest SpotRepository → JSON) */
export interface SpotDto {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bortleClass: number;
  elevationM: number;
  hasParking: boolean;
  hasToilet: boolean;
  locationRadiusM: number;
}

/** GET /notifications/history */
export interface NotificationHistoryItemDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationHistoryResponseDto {
  items: NotificationHistoryItemDto[];
  unreadCount: number;
  hasMore: boolean;
}

/** GET/PUT /notifications/preferences */
export interface NotificationPreferenceDto {
  userId: string;
  alertsEnabled: boolean;
  starIndexAlertEnabled: boolean;
  /** 위치한 곳 Star-Index 푸시 (MAIN·ME) */
  locationStarIndexAlertEnabled?: boolean;
  /** Star-Index 푸시 임계값 — 80·85·90·95 */
  starIndexAlertThreshold?: number;
  /** Star-Index 임계 알림 기준 명소(ME) — 없으면 서버 스케줄에서 제외 */
  alertSpotId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

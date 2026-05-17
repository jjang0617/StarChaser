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
  score: number;
  weatherSnapshot: WeatherSnapshotDto;
  display?: StarIndexCardDisplayDto;
  cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
  message: string;
  requestedBy: string;
}

export interface AuthTokensResponseDto {
  user: { id: string; email: string };
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

/** GET /top5/weekly 한 줄 */
/** GET/PUT /notifications/preferences */
export interface NotificationPreferenceDto {
  userId: string;
  alertsEnabled: boolean;
  starIndexAlertEnabled: boolean;
  astronomyEventAlertEnabled: boolean;
  top5AlertEnabled: boolean;
  /** Star-Index 임계 알림 기준 명소 — 없으면 서버 스케줄에서 제외 */
  alertSpotId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyTop5ItemDto {
  id: string;
  /** 집계 기준 월요일 (YYYY-MM-DD) */
  weekStart: string;
  rank: number;
  spotId: string;
  spotName: string;
  avgStarIndex: number;
  /** 표시용 문자열 (불필요한 0 제거) */
  avgStarIndexText: string;
}

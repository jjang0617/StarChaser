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
}

export interface StarIndexResponseDto {
  spotId: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  bortleClass: number;
  score: number;
  weatherSnapshot: WeatherSnapshotDto;
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

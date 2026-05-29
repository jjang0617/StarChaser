export type LatLng = { lat: number; lng: number };

export type MapSpot = {
  id: string;
  lat: number;
  lng: number;
  /** 전체 명칭(시트·툴팁) */
  title?: string;
  /** 광역 클러스터 키 (경기, 경북, …) */
  regionKey?: string;
  /** 지도에만 쓰는 짧은 이름(주차장 등 생략) */
  shortTitle?: string;
  /** 마커에 항상 표시할 라벨 — 시·도 + 시·군 접두 제거한 핵심 명칭 */
  markerLabel?: string;
};

/** WebView CLUSTER_SPOTS 메시지 한 줄 — 문자열 필드는 빈 문자열 가능 */
export type ClusterSpotRnDto = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  shortTitle: string;
  regionKey: string;
};

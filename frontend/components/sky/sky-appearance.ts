/** 관측 시각 기준 태양 고도 → 하늘 색·별·은하 가시도 (MVP 근사) */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function rgbToHex(r: number, g: number, b: number): string {
  const q = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${q(r)}${q(g)}${q(b)}`;
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string {
  const u = clamp01(t);
  return rgbToHex(
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  );
}

/**
 * 태양 고도(°)에 따른 하늘 배경색·별·별선·라벨 투명도.
 * 낮에도 별은 완전히 숨기지 않고(교육용 MVP) 연하게 유지.
 */
export function skyBackdropFromSunAlt(altDeg: number): {
  zenith: string;
  mid: string;
  horizon: string;
  zenithCoolOpacity: number;
  milkyOpacity: number;
  starOpacity: number;
  lineOpacity: number;
  labelOpacity: number;
  lightOpacity: number;
  campGround: string;
  campPine: string;
  campTrunk: string;
  campTent: string;
  campTentAccent: string;
} {
  /** 0 = 한밤, 1 = 대낮에 가까움 */
  const dayFactor = clamp01((altDeg - (-10)) / (28 - (-10)));

  const zenithNight: [number, number, number] = [2, 5, 22];
  const zenithDay: [number, number, number] = [98, 172, 252];
  const midNight: [number, number, number] = [10, 12, 38];
  const midDay: [number, number, number] = [150, 205, 255];
  const horizonNight: [number, number, number] = [14, 10, 28];
  const horizonDay: [number, number, number] = [210, 232, 255];

  const zenith = mixRgb(zenithNight, zenithDay, dayFactor);
  const mid = mixRgb(midNight, midDay, dayFactor * 0.92);
  const horizon = mixRgb(horizonNight, horizonDay, Math.pow(dayFactor, 0.85));

  const zenithCoolOpacity = (1 - dayFactor) * 0.38;

  const milkyOpacity = (1 - dayFactor * 0.92) * (altDeg < 8 ? 0.58 : 0.22);

  const floorDay = 0.42;
  let starOpacity: number;
  if (altDeg >= 55) {
    starOpacity = floorDay + 0.06;
  } else if (altDeg >= 12) {
    starOpacity = floorDay + 0.06 + ((55 - altDeg) / 43) * 0.4;
  } else if (altDeg >= 0) {
    starOpacity = 0.82 + (1 - altDeg / 12) * 0.14;
  } else if (altDeg >= -14) {
    starOpacity = 0.52 + ((14 + altDeg) / 14) * 0.48;
  } else {
    starOpacity = 1;
  }

  const lineOpacity = Math.max(0.14, 0.28 * starOpacity);
  const labelOpacity = Math.max(0.38, 0.88 * starOpacity);
  /**
   * 캠프 조명(텐트·랜턴·모닥불 불빛) 세기. 밤=1, 박명에 걸쳐 사그라들고 낮=0.
   * 땅·나무·텐트 자체는 색만 바뀌고(아래) 불빛만 이 값으로 끈다.
   */
  const lightOpacity = clamp01(1 - dayFactor * 2);

  /**
   * 전경(땅·나무·텐트) 색: 한밤엔 검은 실루엣, 새벽(해 ~-6°)부터 점점 본연의 색으로,
   * 해가 ~12° 뜨면 완전한 낮 색. 색만 변할 뿐 형태/선명도는 그대로.
   */
  const colorT = clamp01((altDeg + 6) / 18);
  const campNight: [number, number, number] = [4, 5, 12];
  const campGround = mixRgb(campNight, [74, 72, 54], colorT); // 흙·풀 섞인 자연색 땅
  const campPine = mixRgb(campNight, [46, 84, 52], colorT); // 초록 침엽수
  const campTrunk = mixRgb(campNight, [88, 60, 40], colorT); // 갈색 줄기
  const campTent = mixRgb(campNight, [212, 184, 138], colorT); // 베이지 텐트
  const campTentAccent = mixRgb(campNight, [226, 124, 54], colorT); // 주황 텐트

  return {
    zenith,
    mid,
    horizon,
    zenithCoolOpacity,
    milkyOpacity,
    starOpacity,
    lineOpacity,
    labelOpacity,
    lightOpacity,
    campGround,
    campPine,
    campTrunk,
    campTent,
    campTentAccent,
  };
}

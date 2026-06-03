import React from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import type { SkyViewBodyDto } from '../../../lib/api-client';
import { magToRadius } from '../sky-projection';
import type { CampColors } from '../sky-tab-constants';

/** 16진수 색을 f배 어둡게(0~1) — 같은 색 계열로 지붕/도어 음영을 만든다 */
function darkenHex(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * f);
  const g = cl(((n >> 8) & 255) * f);
  const b = cl((n & 255) * f);
  const h2 = (x: number) => x.toString(16).padStart(2, '0');
  return `#${h2(r)}${h2(g)}${h2(b)}`;
}

const BODY_LABEL_FONT =
  Platform.OS === 'ios'
    ? 'Helvetica Neue'
    : Platform.OS === 'android'
      ? 'sans-serif'
      : undefined;

/** astronomy-engine 기반 위상 — 이분 원형 오버레이 근사 */
export function MoonDiskGlyph({
  nx,
  ny,
  lit,
  moonPhaseDeg,
}: {
  nx: number;
  ny: number;
  lit: number;
  moonPhaseDeg: number;
}) {
  const moonR = 5.7;
  if (lit >= 0.997) {
    return (
      <Circle
        cx={nx}
        cy={ny}
        r={moonR}
        fill="#fff6dc"
        stroke="#d4b878"
        strokeWidth={0.45}
      />
    );
  }
  if (lit <= 0.003) {
    return (
      <Circle cx={nx} cy={ny} r={moonR * 0.45} fill="#2a2835" opacity={0.95} />
    );
  }
  const waxing = moonPhaseDeg > 0 && moonPhaseDeg < 180;
  const dx = waxing ? -moonR * 1.92 * (1 - lit) : moonR * 1.92 * (1 - lit);
  return (
    <>
      <Circle cx={nx} cy={ny} r={moonR} fill="#fff6dc" stroke="#c9a662" strokeWidth={0.35} />
      <Circle cx={nx + dx} cy={ny} r={moonR} fill="#121018" fillOpacity={0.88} />
    </>
  );
}

/** 바깥 halo 없음 — 작은 별꼴 Path만 (등급별 크기) */
export function CompactStarGlyph({
  nx,
  ny,
  mag,
  opacityScale,
}: {
  nx: number;
  ny: number;
  mag: number;
  opacityScale: number;
}) {
  const rr = Math.min(1.28, magToRadius(mag) * 0.48);
  const spikes = 4;
  const outer = rr;
  const inner = rr * 0.36;
  let d = '';
  for (let i = 0; i < spikes * 2; i += 1) {
    const ang = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    const x = nx + rad * Math.cos(ang);
    const y = ny + rad * Math.sin(ang);
    d += i === 0 ? `M${x.toFixed(3)} ${y.toFixed(3)}` : `L${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  d += 'Z';
  const base = Math.max(0.22, Math.min(1, 1.02 - mag * 0.088));
  const vis = base * opacityScale;
  if (vis < 0.02) return null;
  return <Path d={d} fill="#eef3ff" fillOpacity={vis} />;
}

/** 행성·달 — 라벨을 원형 배지 안에 (샘 플랫 MVP 타이포) */
export function CelestialBodyMarker({
  nx,
  ny,
  body,
}: {
  nx: number;
  ny: number;
  body: SkyViewBodyDto;
}) {
  const label = body.labelKo;

  if (body.id === 'moon') {
    const mr = 5.7;
    const badgeCy = ny + mr + 5;
    const badgeR = Math.max(5.6, 3.2 + Math.min(label.length, 7) * 2);
    return (
      <G>
        <MoonDiskGlyph
          nx={nx}
          ny={ny - 1}
          lit={body.phaseFraction ?? 1}
          moonPhaseDeg={body.moonPhaseDeg ?? 90}
        />
        <Circle
          cx={nx}
          cy={badgeCy}
          r={badgeR}
          fill="rgba(16,14,28,0.94)"
          stroke="rgba(255,212,170,0.45)"
          strokeWidth={0.26}
        />
        <SvgText
          x={nx}
          y={badgeCy + 1}
          fill="#f7f4ff"
          fontSize={2.52}
          fontWeight="600"
          fontFamily={BODY_LABEL_FONT}
          letterSpacing={0.15}
          textAnchor="middle"
        >
          {label}
        </SvgText>
      </G>
    );
  }

  const diskR = Math.max(6.4, 4.2 + Math.min(label.length, 7) * 2.05);
  const isVenus = body.id === 'venus';
  const plate = isVenus ? '#fff9f6' : '#fdf8f0';
  const rim = isVenus ? '#f0d8cc' : '#dccfb8';
  const ink = '#3a3548';

  return (
    <G>
      <Circle
        cx={nx}
        cy={ny}
        r={diskR}
        fill={plate}
        fillOpacity={0.97}
        stroke={rim}
        strokeWidth={0.34}
      />
      <Circle
        cx={nx}
        cy={ny - diskR * 0.42}
        r={2.05}
        fill={isVenus ? '#ffe8dc' : '#f2e6d4'}
        opacity={0.96}
      />
      <SvgText
        x={nx}
        y={ny + diskR * 0.28}
        fill={ink}
        fontSize={2.48}
        fontWeight="600"
        fontFamily={BODY_LABEL_FONT}
        letterSpacing={0.12}
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </G>
  );
}

/** 태양 — 짧은 방사선 + 디스크 (suncalc 근사 고도) */
export function SunGlyph({
  nx,
  ny,
  altDeg,
}: {
  nx: number;
  ny: number;
  altDeg: number;
}) {
  if (altDeg < -3.5) return null;
  const r = 4.4;
  const rayLen = 7.2;
  const rays = 8;
  const diskOp = altDeg < -1 ? 0.65 + ((altDeg + 3.5) / 2.5) * 0.35 : 1;
  return (
    <G opacity={diskOp}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i * Math.PI * 2) / rays - Math.PI / 2;
        return (
          <Line
            key={i}
            x1={nx}
            y1={ny}
            x2={nx + Math.cos(a) * rayLen}
            y2={ny + Math.sin(a) * rayLen}
            stroke="#fff8e6"
            strokeWidth={0.5}
            strokeOpacity={0.88}
            strokeLinecap="round"
          />
        );
      })}
      <Circle
        cx={nx}
        cy={ny}
        r={r}
        fill="#fff3c8"
        stroke="#ffc040"
        strokeWidth={0.32}
        opacity={0.98}
      />
    </G>
  );
}

/** 패널 펼침 — 초 없이 한 줄 */
export function formatKstShort(isoUtc: string): string {
  try {
    return new Date(isoUtc).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export function formatKstHm(isoUtc: string): string {
  try {
    return new Date(isoUtc).toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/**
 * 디테일 있는 글램핑 텐트(단색). round=true면 둥근 벨 텐트, false면 박공형 캐빈 텐트.
 * 본체는 한 가지 색, 지붕·도어는 그 색의 음영으로만 표현(한 텐트=한 색).
 * 굴뚝·당김줄·도어 분할선·입구 빛으로 디테일을 더한다. lightOpacity로 입구 빛만 점등.
 */
function GlampTent({
  cx,
  foot,
  hw,
  h,
  body,
  round,
  lightOpacity,
}: {
  cx: number;
  foot: number;
  hw: number;
  h: number;
  body: string;
  round: boolean;
  lightOpacity: number;
}) {
  const wallTop = foot - h * 0.42;
  const peak = foot - h;
  const shoulder = foot - h * 0.8;
  const roofShade = darkenHex(body, 0.82);
  const seam = darkenHex(body, 0.7);
  const doorShade = darkenHex(body, 0.52);
  const doorSplit = darkenHex(body, 0.38);
  const dw = hw * 0.32;
  const doorTop = foot - h * 0.5;
  const f = (n: number) => n.toFixed(1);

  const bodyPath = round
    ? `M ${f(cx - hw)} ${f(foot)} L ${f(cx - hw)} ${f(wallTop)} Q ${f(cx - hw)} ${f(peak)} ${f(cx)} ${f(peak)} Q ${f(cx + hw)} ${f(peak)} ${f(cx + hw)} ${f(wallTop)} L ${f(cx + hw)} ${f(foot)} Z`
    : `M ${f(cx - hw)} ${f(foot)} L ${f(cx - hw)} ${f(wallTop)} L ${f(cx - hw * 0.5)} ${f(shoulder)} L ${f(cx)} ${f(peak)} L ${f(cx + hw * 0.5)} ${f(shoulder)} L ${f(cx + hw)} ${f(wallTop)} L ${f(cx + hw)} ${f(foot)} Z`;
  const roofPath = round
    ? `M ${f(cx - hw)} ${f(wallTop)} Q ${f(cx - hw)} ${f(peak)} ${f(cx)} ${f(peak)} Q ${f(cx + hw)} ${f(peak)} ${f(cx + hw)} ${f(wallTop)} Z`
    : `M ${f(cx - hw)} ${f(wallTop)} L ${f(cx - hw * 0.5)} ${f(shoulder)} L ${f(cx)} ${f(peak)} L ${f(cx + hw * 0.5)} ${f(shoulder)} L ${f(cx + hw)} ${f(wallTop)} Z`;
  const doorPath = `M ${f(cx - dw)} ${f(foot)} L ${f(cx - dw)} ${f(doorTop + 1.6)} Q ${f(cx)} ${f(doorTop)} ${f(cx + dw)} ${f(doorTop + 1.6)} L ${f(cx + dw)} ${f(foot)} Z`;
  const glowPath = `M ${f(cx - dw * 0.66)} ${f(foot)} L ${f(cx - dw * 0.66)} ${f(doorTop + 2.4)} Q ${f(cx)} ${f(doorTop + 1.2)} ${f(cx + dw * 0.66)} ${f(doorTop + 2.4)} L ${f(cx + dw * 0.66)} ${f(foot)} Z`;

  return (
    <>
      {/* 당김줄(가이라인) */}
      <Path
        d={`M ${f(cx - hw)} ${f(wallTop + 1)} L ${f(cx - hw - 3.5)} ${f(foot)}`}
        stroke={roofShade}
        strokeWidth={0.3}
        opacity={0.5}
      />
      <Path
        d={`M ${f(cx + hw)} ${f(wallTop + 1)} L ${f(cx + hw + 3.5)} ${f(foot)}`}
        stroke={roofShade}
        strokeWidth={0.3}
        opacity={0.5}
      />
      {/* 본체 */}
      <Path d={bodyPath} fill={body} />
      {/* 지붕 음영(두 톤) */}
      <Path d={roofPath} fill={roofShade} />
      {/* 벽 이음선 */}
      <Path d={`M ${f(cx - hw * 0.5)} ${f(wallTop)} L ${f(cx - hw * 0.5)} ${f(foot)}`} stroke={seam} strokeWidth={0.25} opacity={0.6} />
      <Path d={`M ${f(cx + hw * 0.5)} ${f(wallTop)} L ${f(cx + hw * 0.5)} ${f(foot)}`} stroke={seam} strokeWidth={0.25} opacity={0.6} />
      {/* 도어 */}
      <Path d={doorPath} fill={doorShade} />
      <Path d={`M ${f(cx)} ${f(foot)} L ${f(cx)} ${f(doorTop + 0.8)}`} stroke={doorSplit} strokeWidth={0.3} />
      {/* 입구에서 새어 나오는 빛 */}
      <Path d={glowPath} fill="url(#tentGlow)" opacity={lightOpacity} />
    </>
  );
}

/**
 * 돔 텐트(첨부 일러스트 참조) — 넓고 둥근 돔 본체(살짝 뾰족한 꼭대기), 옆면 패널 솔기,
 * 가운데 큰 아치형 입구(밝은 테두리 + 어두운 내부 + 밤엔 안쪽 빛), 바닥 고정 스테이크.
 * 단색 본체에 같은 색의 명암으로만 디테일을 준다.
 */
function DomeTent({
  cx,
  foot,
  hw,
  h,
  body,
  lightOpacity,
}: {
  cx: number;
  foot: number;
  hw: number;
  h: number;
  body: string;
  lightOpacity: number;
}) {
  const peak = foot - h;
  const seam = darkenHex(body, 0.78);
  const frameLight = darkenHex(body, 1.16);
  const interior = darkenHex(body, 0.24);
  const baseLine = darkenHex(body, 0.55);
  const stake = darkenHex(body, 0.45);
  const f = (n: number) => n.toFixed(1);
  // 아치(문/내부) path: 수직 옆선 + 둥근 윗부분, 바닥 평평
  const arch = (acx: number, aw: number, ayTop: number, ayBot: number) => {
    const sh = ayTop + aw * 0.8;
    return `M ${f(acx - aw)} ${f(ayBot)} L ${f(acx - aw)} ${f(sh)} Q ${f(acx - aw)} ${f(ayTop)} ${f(acx)} ${f(ayTop)} Q ${f(acx + aw)} ${f(ayTop)} ${f(acx + aw)} ${f(sh)} L ${f(acx + aw)} ${f(ayBot)} Z`;
  };
  const frameW = hw * 0.58;
  const frameTop = foot - h * 0.84;
  const intW = frameW - 1;
  const intTop = frameTop + 1.3;
  return (
    <>
      {/* 넓고 둥근 돔 본체 — 어깨가 둥글고 위가 부드럽게 둥근 반타원형 외곽선 */}
      <Path
        d={`M ${f(cx - hw)} ${f(foot)} C ${f(cx - hw)} ${f(foot - h * 0.9)} ${f(cx - hw * 0.52)} ${f(peak)} ${f(cx)} ${f(peak)} C ${f(cx + hw * 0.52)} ${f(peak)} ${f(cx + hw)} ${f(foot - h * 0.9)} ${f(cx + hw)} ${f(foot)} Z`}
        fill={body}
      />
      {/* 윗부분 크라운 패널 솔기 */}
      <Path
        d={`M ${f(cx - hw * 0.55)} ${f(foot - h * 0.74)} Q ${f(cx)} ${f(foot - h * 1.0)} ${f(cx + hw * 0.55)} ${f(foot - h * 0.74)}`}
        stroke={seam}
        strokeWidth={0.35}
        fill="none"
        opacity={0.55}
      />
      {/* 가운데 패널을 감싸는 좌·우 솔기(꼭대기 → 바닥) */}
      <Path
        d={`M ${f(cx)} ${f(peak + 0.5)} Q ${f(cx - hw * 0.5)} ${f(foot - h * 0.45)} ${f(cx - hw * 0.62)} ${f(foot)}`}
        stroke={seam}
        strokeWidth={0.35}
        fill="none"
        opacity={0.55}
      />
      <Path
        d={`M ${f(cx)} ${f(peak + 0.5)} Q ${f(cx + hw * 0.5)} ${f(foot - h * 0.45)} ${f(cx + hw * 0.62)} ${f(foot)}`}
        stroke={seam}
        strokeWidth={0.35}
        fill="none"
        opacity={0.55}
      />
      {/* 바닥 그림자선 */}
      <Path d={`M ${f(cx - hw)} ${f(foot)} L ${f(cx + hw)} ${f(foot)}`} stroke={baseLine} strokeWidth={0.4} opacity={0.6} />
      {/* 입구: 밝은 테두리 → 어두운 내부 → (밤) 안쪽 빛 */}
      <Path d={arch(cx, frameW, frameTop, foot)} fill={frameLight} />
      <Path d={arch(cx, intW, intTop, foot)} fill={interior} />
      <Path d={arch(cx, intW, intTop, foot)} fill="url(#tentGlow)" opacity={lightOpacity} />
      {/* 바닥 고정 스테이크(좌·우) */}
      <Path d={`M ${f(cx - hw)} ${f(foot)} L ${f(cx - hw - 2.4)} ${f(foot + 1.4)}`} stroke={stake} strokeWidth={0.45} />
      <Path d={`M ${f(cx - hw - 3)} ${f(foot + 1.4)} L ${f(cx - hw - 1.8)} ${f(foot + 1.4)}`} stroke={stake} strokeWidth={0.45} />
      <Path d={`M ${f(cx + hw)} ${f(foot)} L ${f(cx + hw + 2.4)} ${f(foot + 1.4)}`} stroke={stake} strokeWidth={0.45} />
      <Path d={`M ${f(cx + hw + 3)} ${f(foot + 1.4)} L ${f(cx + hw + 1.8)} ${f(foot + 1.4)}`} stroke={stake} strokeWidth={0.45} />
    </>
  );
}

/**
 * 침엽수(전나무) 잎 실루엣 path — tiers 단의 가지가 바깥 끝으로 살짝 처지는(droop) 모양.
 * 아래로 갈수록 넓어지고, 단끼리 겹쳐 자연스러운 전나무 윤곽을 만든다(3단/5단 등).
 */
export function pinePath(cx: number, footY: number, h: number, w: number, tiers: number): string {
  const trunkH = h * 0.12;
  const top = footY - h;
  const foliageBot = footY - trunkH * 0.3;
  const foliageH = foliageBot - top;
  const step = foliageH / tiers;
  const F = (n: number) => n.toFixed(1);
  let d = '';
  for (let i = 0; i < tiers; i += 1) {
    const apexY = top + i * step;
    const baseY = apexY + step * 1.95;
    const hw = (w / 2) * (0.34 + 0.66 * ((i + 1) / tiers));
    const droop = hw * 0.42; // 바깥 가지 끝이 가운데보다 아래로 처짐
    d += `M ${F(cx)} ${F(apexY)} L ${F(cx - hw)} ${F(baseY)} Q ${F(cx)} ${F(baseY - droop)} ${F(cx + hw)} ${F(baseY)} Z `;
  }
  return d;
}

/** 침엽수 한 그루: 갈색 줄기 + 다층 처진 잎(tiers로 3단/5단 등 다양하게) */
function PineTree({
  cx,
  footY,
  h,
  w,
  colors,
  tiers = 4,
  opacity = 1,
}: {
  cx: number;
  footY: number;
  h: number;
  w: number;
  colors: CampColors;
  tiers?: number;
  opacity?: number;
}) {
  const trunkH = h * 0.12;
  const trunkW = Math.max(0.8, w * 0.12);
  return (
    <G opacity={opacity}>
      <Rect x={cx - trunkW / 2} y={footY - trunkH} width={trunkW} height={trunkH + 0.4} fill={colors.trunk} />
      <Path d={pinePath(cx, footY, h, w, tiers)} fill={colors.pine} />
    </G>
  );
}

/**
 * 활엽수(첨부 이미지 참조) — 가는 줄기 위로 키가 크고 꽉 찬 타원형(달걀형) 수관.
 * 수관은 여러 작은 덩이를 위→아래로 쌓아 가운데가 가장 넓은 자연스러운 윤곽을 만든다.
 */
function BroadleafTree({
  cx,
  footY,
  h,
  colors,
}: {
  cx: number;
  footY: number;
  h: number;
  colors: CampColors;
}) {
  const trunkH = h * 0.26;
  const crownTop = footY - h;
  const crownH = h * 0.82;
  const rMax = h * 0.24;
  const F = (n: number) => n.toFixed(1);
  // [세로위치(0=꼭대기,1=아래), 가로offset(rMax비율), 반지름(rMax비율)]
  const blobs: Array<[number, number, number]> = [
    [0.05, 0, 0.45],
    [0.18, -0.55, 0.5],
    [0.18, 0.55, 0.52],
    [0.3, 0.05, 0.72],
    [0.4, -0.8, 0.55],
    [0.42, 0.85, 0.56],
    [0.52, -0.36, 0.78],
    [0.54, 0.46, 0.76],
    [0.68, -0.74, 0.6],
    [0.7, 0.78, 0.62],
    [0.72, 0.05, 0.74],
    [0.86, -0.4, 0.56],
    [0.88, 0.44, 0.56],
  ];
  return (
    <>
      {/* 가는 줄기(살짝 테이퍼) + 낮은 가지 */}
      <Path
        d={`M ${F(cx - 1.2)} ${F(footY)} L ${F(cx - 0.5)} ${F(footY - trunkH)} L ${F(cx + 0.5)} ${F(footY - trunkH)} L ${F(cx + 1.2)} ${F(footY)} Z`}
        fill={colors.trunk}
      />
      <Path d={`M ${F(cx)} ${F(footY - trunkH * 0.7)} L ${F(cx - 2.2)} ${F(footY - trunkH * 1.35)}`} stroke={colors.trunk} strokeWidth={0.6} />
      <Path d={`M ${F(cx)} ${F(footY - trunkH * 0.8)} L ${F(cx + 2.4)} ${F(footY - trunkH * 1.45)}`} stroke={colors.trunk} strokeWidth={0.6} />
      {/* 키 큰 타원형 수관 */}
      {blobs.map((b, i) => (
        <Circle
          key={`leaf-${i}`}
          cx={cx + b[1] * rMax}
          cy={crownTop + b[0] * crownH}
          r={b[2] * rMax}
          fill={colors.pine}
        />
      ))}
    </>
  );
}

/**
 * 별 보러 온 캠핑 명소의 전경 한 타일. 평평한 땅 위에 나무들과 텐트가 서 있고 텐트·랜턴에서
 * 빛이 새어 나온다(언덕은 없음 — 이미 언덕 위에 서 있다는 설정). x[0,CAMP_TILE] 로컬
 * 좌표로 그려 가로로 이어붙이면(타일링) 시선 회전 시 매끄럽게 흐른다. 땅(바닥)은 따로 한
 * 겹으로 그리므로 여기선 나무·텐트·불빛만 그린다.
 *
 * variant(0/1)로 서로 다른 캠프 두 종류(A형 텐트 / 돔형 텐트, 나무 배치도 다름)를 그린다.
 * 한 바퀴(360°)에 정확히 캠프 2개가 있어, 인접한 두 캠프는 항상 다른 모습이다.
 * colors는 시각(밤=검정 실루엣 → 낮=본연의 색)에 따라 바뀌고, lightOpacity로 조명
 * (텐트 입구·랜턴·모닥불)을 낮엔 끄고 밤엔 켠다.
 */
export function CampSceneTile({
  y,
  variant,
  lightOpacity,
  colors,
}: {
  y: number;
  variant: number;
  lightOpacity: number;
  colors: CampColors;
}) {
  const foot = y + 0.5;
  if (variant === 1) {
    // 캠프 B — 주황 벨(돔) 텐트 + 왼쪽 활엽수·침엽수 무리, 오른쪽 큰 침엽수
    return (
      <>
        <PineTree cx={28} footY={y - 1} h={9} w={6} colors={colors} tiers={3} opacity={0.62} />
        <PineTree cx={62} footY={y - 1} h={10} w={6.5} colors={colors} tiers={4} opacity={0.62} />
        {/* 텐트 주변 분위기 글로우 */}
        <Circle cx={50} cy={y - 2} r={16} fill="url(#campGlow)" opacity={lightOpacity} />
        {/* 왼쪽 나무들 */}
        <BroadleafTree cx={12} footY={foot} h={19} colors={colors} />
        <PineTree cx={22} footY={foot} h={17} w={9} colors={colors} tiers={5} />
        <PineTree cx={31} footY={foot} h={12} w={7.5} colors={colors} tiers={3} />
        {/* 주황 돔 텐트(단색) */}
        <DomeTent cx={50} foot={foot} hw={9.1} h={10.4} body={colors.accent} lightOpacity={lightOpacity} />
        {/* 오른쪽 큰 침엽수 무리 */}
        <PineTree cx={72} footY={foot} h={22} w={11} colors={colors} tiers={5} />
        <PineTree cx={82} footY={foot} h={14} w={7} colors={colors} tiers={3} />
        {/* 랜턴 불씨 */}
        <Circle cx={38} cy={y - 0.3} r={1.3} fill="#ffd9a0" opacity={0.95 * lightOpacity} />
      </>
    );
  }
  // 캠프 A — 베이지 캐빈(박공) 텐트 + 왼쪽 큰 침엽수·활엽수, 오른쪽 침엽수 무리
  return (
    <>
      <PineTree cx={33} footY={y - 1} h={10} w={6.5} colors={colors} tiers={4} opacity={0.62} />
      <PineTree cx={58} footY={y - 1} h={9} w={6} colors={colors} tiers={3} opacity={0.62} />
      {/* 텐트 주변 분위기 글로우 */}
      <Circle cx={44} cy={y - 2} r={15} fill="url(#campGlow)" opacity={lightOpacity} />
      {/* 왼쪽 나무들 */}
      <PineTree cx={10} footY={foot} h={21} w={11} colors={colors} tiers={5} />
      <BroadleafTree cx={24} footY={foot} h={19} colors={colors} />
      {/* 오른쪽 나무 무리 */}
      <PineTree cx={66} footY={foot} h={16} w={8.5} colors={colors} tiers={3} />
      <PineTree cx={73} footY={foot} h={22} w={11} colors={colors} tiers={5} />
      <PineTree cx={85} footY={foot} h={13} w={7} colors={colors} tiers={3} />
      {/* 베이지 캐빈 텐트(단색 + 음영 디테일) */}
      <GlampTent cx={44} foot={foot} hw={9} h={15} body={colors.tent} round={false} lightOpacity={lightOpacity} />
      {/* 모닥불 불씨 */}
      <Circle cx={56} cy={y - 0.3} r={1.3} fill="#ffd9a0" opacity={0.95 * lightOpacity} />
    </>
  );
}

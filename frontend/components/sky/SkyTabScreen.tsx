import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Gyroscope } from 'expo-sensors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import { Button, Card } from '../ui';
import { GlassCard } from '../ui/GlassCard';
import {
  ApiRequestError,
  fetchConstellationLines,
  fetchSkyView,
  fetchStarIndexAtLocation,
  SessionExpiredError,
  type ConstellationLineSegmentDto,
  type SkyViewBodyDto,
  type SkyViewResponseDto,
  type SkyViewStarDto,
} from '../../lib/api-client';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { fetchSpotById } from '../../lib/spots-api';
import { getConstellationLore } from './constellation-lore';
import { SkyGlCanvas } from './SkyGlCanvas';
import { sunAltAzDeg } from '../../lib/sun-position';
import {
  computeViewBasis,
  GL_TAN_HALF_FOV,
  magToRadius,
  normToLayoutSlice,
  projectPerspectiveClip,
  projectToView,
} from './sky-projection';
import { skyBackdropFromSunAlt } from './sky-appearance';
import { namedStarLabelKo } from './named-star-labels';
import { layoutNamedStarLabels, type LabelAnchor } from './sky-label-layout';
import { formatStarDistanceLyAu } from '../../lib/star-distance-format';

/** IAU 별자리 3글자 약어 → 한글(주요 별군만) */
const CON_LABEL_KO: Record<string, string> = {
  Ori: '오리온',
  Aur: '마차부',
  Tau: '황소',
  Gem: '쌍둥이',
  CMi: '작은개',
  CMa: '큰개',
  Car: '용골',
  Cen: '센타우루스',
  Cru: '남십자',
  Vir: '처녀',
  Lyr: '거문고',
  Cyg: '백조',
  Aql: '독수리',
  UMi: '작은곰',
  Boo: '목동',
  Sco: '전갈',
  UMa: '큰곰',
  PsA: '남쪽물고기',
  Pup: '고물',
  Tri: '여름삼각',
};

/** 별 탭 히트 영역 (px) — 최소 터치 타깃 근사 */
const STAR_HIT_PX = 44;

type SkyOverlaySheet =
  | { kind: 'constellation'; con: string; labelKo: string }
  | { kind: 'star'; star: SkyViewStarDto };

export interface SkyTabScreenProps {
  observerLat: number | null;
  observerLng: number | null;
  /** GPS가 없을 때 GET /spots/:id 로 보조 좌표 */
  observerSpotId: string | null;
  observeAtIso: string;
  onShiftHours: (deltaHours: number) => void;
  onObserveNow: () => void;
  onSessionInvalidated: () => Promise<void>;
  /** 기기 GPS로 천구 중심을 잡는 중인지 */
  skyUsesGps: boolean;
  /** 마이페이지에서 위치 기능을 켠 경우에만 OS 권한 UI 표시 */
  locationFeaturesEnabled?: boolean;
  /** expo-location 전경 위치 권한(null이면 아직 조회 전) */
  locationPermissionStatus?: Location.PermissionResponse['status'] | null;
  /** 위치 권한 시스템 다이얼로그 재요청 */
  onRequestLocationPermission?: () => void | Promise<void>;
}

/** astronomy-engine 기반 위상 — 이분 원형 오버레이 근사 */
function MoonDiskGlyph({
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
function CompactStarGlyph({
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

const BODY_LABEL_FONT =
  Platform.OS === 'ios'
    ? 'Helvetica Neue'
    : Platform.OS === 'android'
      ? 'sans-serif'
      : undefined;

/** 행성·달 — 라벨을 원형 배지 안에 (샘 플랫 MVP 타이포) */
function CelestialBodyMarker({
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
function SunGlyph({
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

function formatKstFull(isoUtc: string): string {
  try {
    return new Date(isoUtc).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function formatUtcFootnote(isoUtc: string): string {
  const w = isoUtc.slice(0, 19).replace('T', ' ');
  return `${w} UTC (천문 API·계산 동일 시각)`;
}

function formatKstHm(isoUtc: string): string {
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

const SKY_RENDER_STORAGE_KEY = 'starChaser:skyRenderMode';
const SKY_CONTROLS_EXPANDED_KEY = 'starChaser:skyControlsExpanded';

const HEADING_LOWPASS = 0.88;
/** 자이로 보조 시 나침반에 가끔 붙는 가중(드리프트 억제) */
const COMPASS_BLEND_MOTION = 0.07;

/** 1인칭 자유 시점 카메라 — 드래그 감도(°/px)와 시선 고도 범위 */
const VIEW_YAW_GAIN = 0.2;
const VIEW_PITCH_GAIN = 0.2;
/** 시선 고도: 지평선(0°, 정면)부터 천정(90°, 수직으로 올려다봄)까지만 */
const VIEW_ALT_MIN = 0;
const VIEW_ALT_MAX = 90;
/** 처음 시선: 남쪽 지평선을 정면으로(서서 앞을 보는 느낌) */
const VIEW_DEFAULT_YAW = 180;
const VIEW_DEFAULT_PITCH = 0;

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normYaw(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** 한 타일 폭(viewBox 단위). 360°↔2타일이라 좌우로 끝없이 돌려도 이음새가 없음 */
const CAMP_TILE = 90;
/** 지평선 화면 높이: 정면(0°)에서 하단에 낮게, 올려다볼수록 아래로 내려가 사라짐 */
const CAMP_HORIZON_BASE = 82;
const CAMP_HORIZON_SLOPE = 0.5;

type CampColors = {
  pine: string;
  trunk: string;
  tent: string;
  accent: string;
};

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
function pinePath(cx: number, footY: number, h: number, w: number, tiers: number): string {
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
function CampSceneTile({
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

export function SkyTabScreen({
  observerLat,
  observerLng,
  observerSpotId,
  observeAtIso,
  onShiftHours,
  onObserveNow,
  onSessionInvalidated,
  skyUsesGps,
  locationFeaturesEnabled = true,
  locationPermissionStatus = null,
  onRequestLocationPermission,
}: SkyTabScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [skyStage, setSkyStage] = useState({ w: 0, h: 0 });
  /** flex 천구 뷰포트 실측 — OpenGL 버퍼 크기용 */
  const [skyVp, setSkyVp] = useState({ w: 0, h: 0 });
  const [spotFallback, setSpotFallback] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SkyViewResponseDto | null>(null);
  const [lineSegments, setLineSegments] = useState<ConstellationLineSegmentDto[]>([]);
  const [alignHeading, setAlignHeading] = useState(false);
  const [motionAssist, setMotionAssist] = useState(false);
  /**
   * 1인칭 시선 — 방위(좌우)·고도(상하). 수평선은 항상 수평(롤 없음)으로 유지.
   * 가로 드래그=방위 회전(둘러보기), 세로 드래그=고도(0°지평선~90°천정).
   */
  const [viewYawDeg, setViewYawDeg] = useState(VIEW_DEFAULT_YAW);
  const [viewPitchDeg, setViewPitchDeg] = useState(VIEW_DEFAULT_PITCH);
  const [renderEngine, setRenderEngine] = useState<'svg' | 'gl'>('svg');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void AsyncStorage.getItem(SKY_RENDER_STORAGE_KEY).then((raw) => {
      if (raw === 'gl' || raw === 'svg') setRenderEngine(raw);
    });
  }, []);

  /** 기본 접힘 — 별자리 탭이 왼쪽 패널에 가리지 않도록 */
  const [controlsExpanded, setControlsExpanded] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(SKY_CONTROLS_EXPANDED_KEY).then((raw) => {
      if (raw === '1') setControlsExpanded(true);
    });
  }, []);

  const persistControlsExpanded = useCallback((next: boolean) => {
    setControlsExpanded(next);
    void AsyncStorage.setItem(SKY_CONTROLS_EXPANDED_KEY, next ? '1' : '0');
  }, []);

  const persistRenderEngine = useCallback((mode: 'svg' | 'gl') => {
    setRenderEngine(mode);
    if (Platform.OS !== 'web') {
      void AsyncStorage.setItem(SKY_RENDER_STORAGE_KEY, mode);
    }
  }, []);

  const [overlaySheet, setOverlaySheet] = useState<SkyOverlaySheet | null>(null);

  useEffect(() => {
    if (renderEngine === 'gl') setOverlaySheet(null);
  }, [renderEngine]);

  /** SVG 천구만 세로 고정 — 가로 회전 시 왜곡·패닝 UX 저하 방지 */
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const lock = renderEngine === 'svg' && data != null;
    if (!lock) {
      void ScreenOrientation.unlockAsync();
      return undefined;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, [renderEngine, data]);

  const [locStarIndex, setLocStarIndex] = useState<StarIndexResponseDto | null>(null);
  const [locSiLoading, setLocSiLoading] = useState(false);
  const [locSiErr, setLocSiErr] = useState<string | null>(null);

  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [headingErr, setHeadingErr] = useState<string | null>(null);
  const headingSmoothRef = useRef<number | null>(null);
  const fusedHeadingRef = useRef<number | null>(null);
  const lastGyroAtRef = useRef<number>(Date.now());
  const prevMotionAssistRef = useRef(false);

  const obsLat =
    observerLat != null && Number.isFinite(observerLat)
      ? observerLat
      : spotFallback?.lat ?? null;
  const obsLng =
    observerLng != null && Number.isFinite(observerLng)
      ? observerLng
      : spotFallback?.lng ?? null;

  useEffect(() => {
    const hasSi =
      observerLat != null &&
      observerLng != null &&
      Number.isFinite(observerLat) &&
      Number.isFinite(observerLng);
    if (hasSi) {
      setSpotFallback(null);
      return;
    }
    if (!observerSpotId) {
      setSpotFallback(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchSpotById(observerSpotId);
        if (!cancelled) setSpotFallback({ lat: s.lat, lng: s.lng });
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        if (!cancelled) setSpotFallback(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [observerLat, observerLng, observerSpotId, onSessionInvalidated]);

  const load = useCallback(async () => {
    if (obsLat == null || obsLng == null) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const v = await fetchSkyView({
        lat: obsLat,
        lng: obsLng,
        at: observeAtIso,
      });
      setData(v);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      if (e instanceof ApiRequestError) {
        setErr(e.message);
      } else {
        setErr('천구 데이터를 불러오지 못했습니다.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [obsLat, obsLng, observeAtIso, onSessionInvalidated]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setViewYawDeg(VIEW_DEFAULT_YAW);
    setViewPitchDeg(VIEW_DEFAULT_PITCH);
  }, [obsLat, obsLng]);

  useEffect(() => {
    if (
      obsLat == null ||
      obsLng == null ||
      !Number.isFinite(obsLat) ||
      !Number.isFinite(obsLng)
    ) {
      setLocStarIndex(null);
      setLocSiErr(null);
      setLocSiLoading(false);
      return;
    }
    let cancelled = false;
    setLocSiLoading(true);
    setLocSiErr(null);
    void (async () => {
      try {
        const d = await fetchStarIndexAtLocation(obsLat, obsLng, observeAtIso);
        if (!cancelled) setLocStarIndex(d);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        if (!cancelled) {
          if (e instanceof ApiRequestError) {
            setLocSiErr(
              e.status === 503
                ? `${e.message} (서버 캐시·API 키 확인)`
                : e.message,
            );
          } else {
            setLocSiErr('Star-Index를 불러오지 못했습니다.');
          }
          setLocStarIndex(null);
        }
      } finally {
        if (!cancelled) setLocSiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [obsLat, obsLng, observeAtIso, onSessionInvalidated]);

  const locSiDisplay = useMemo(
    () =>
      locStarIndex != null
        ? getStarIndexScoreDisplay(locStarIndex.score)
        : null,
    [locStarIndex],
  );

  useEffect(() => {
    if (obsLat == null || obsLng == null) {
      setLineSegments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchConstellationLines();
        if (!cancelled) setLineSegments(res.segments ?? []);
      } catch {
        if (!cancelled) setLineSegments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [obsLat, obsLng]);

  useEffect(() => {
    if (!alignHeading) {
      setMotionAssist(false);
    }
  }, [alignHeading]);

  useEffect(() => {
    const wasMotion = prevMotionAssistRef.current;
    if (!motionAssist) {
      fusedHeadingRef.current = null;
      if (wasMotion && headingDeg != null) {
        headingSmoothRef.current = headingDeg;
      }
    } else if (!wasMotion && headingDeg != null) {
      fusedHeadingRef.current = headingDeg;
    }
    prevMotionAssistRef.current = motionAssist;
  }, [motionAssist, headingDeg]);

  useEffect(() => {
    if (!alignHeading || Platform.OS === 'web' || !locationFeaturesEnabled) {
      return;
    }
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    headingSmoothRef.current = null;
    setHeadingErr(null);

    void (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        sub = await Location.watchHeadingAsync((h) => {
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (motionAssist) {
            const prev = fusedHeadingRef.current;
            const next =
              prev == null
                ? raw
                : prev * (1 - COMPASS_BLEND_MOTION) + raw * COMPASS_BLEND_MOTION;
            fusedHeadingRef.current = next;
            headingSmoothRef.current = next;
            setHeadingDeg(next);
          } else {
            const prev = headingSmoothRef.current;
            const next =
              prev == null
                ? raw
                : prev * HEADING_LOWPASS + raw * (1 - HEADING_LOWPASS);
            headingSmoothRef.current = next;
            setHeadingDeg(next);
          }
        });
      } catch {
        if (!cancelled) setHeadingErr('나침반을 쓸 수 없습니다. 위치 권한·기기를 확인해 주세요.');
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [alignHeading, motionAssist, locationFeaturesEnabled]);

  useEffect(() => {
    if (!alignHeading || !motionAssist || Platform.OS === 'web') {
      return;
    }
    lastGyroAtRef.current = Date.now();
    Gyroscope.setUpdateInterval(Platform.OS === 'android' ? 200 : 40);
    const sub = Gyroscope.addListener((e) => {
      const now = Date.now();
      const dt = Math.min(0.12, (now - lastGyroAtRef.current) / 1000);
      lastGyroAtRef.current = now;
      if (fusedHeadingRef.current == null) return;
      fusedHeadingRef.current += (-e.z * dt * 180) / Math.PI;
      headingSmoothRef.current = fusedHeadingRef.current;
      setHeadingDeg(fusedHeadingRef.current);
    });
    return () => sub.remove();
  }, [alignHeading, motionAssist]);

  const starsByHip = useMemo(() => {
    const m = new Map<number, SkyViewStarDto>();
    if (!data) return m;
    for (const s of data.stars) m.set(s.hip, s);
    return m;
  }, [data]);

  /** 시선 방위: 나침반(방위 맞춤) 켜지면 기기 방향, 아니면 드래그로 누적한 yaw */
  const viewAz =
    alignHeading && Platform.OS !== 'web' && headingDeg != null
      ? normYaw(headingDeg)
      : viewYawDeg;
  const viewAlt = viewPitchDeg;

  /** 항상 수평인(롤 0) 시선 기저 — 모든 천체 투영에 사용 */
  const viewBasis = useMemo(
    () => computeViewBasis(viewAz, viewAlt),
    [viewAz, viewAlt],
  );

  const useGlView = renderEngine === 'gl' && Platform.OS !== 'web';

  /**
   * (az,alt) → 레이아웃 픽셀. RN 라벨/히트 오버레이가 실제 렌더와 같은 투영을 쓰도록
   * GL이면 원근(perspective), SVG면 어안(azimuthal)으로 분기한다.
   */
  const projectOverlayPx = useCallback(
    (azDeg: number, altDeg: number): { x: number; y: number } | null => {
      if (skyVp.w <= 0 || skyVp.h <= 0) return null;
      if (useGlView) {
        const r = projectPerspectiveClip(
          azDeg,
          altDeg,
          viewBasis,
          GL_TAN_HALF_FOV,
          skyVp.w / skyVp.h,
        );
        if (!r.visible) return null;
        return {
          x: ((r.cx + 1) / 2) * skyVp.w,
          y: ((1 - r.cy) / 2) * skyVp.h,
        };
      }
      const p = projectToView(azDeg, altDeg, viewBasis);
      if (!p.visible) return null;
      return normToLayoutSlice(p.nx, p.ny, skyVp.w, skyVp.h);
    },
    [useGlView, viewBasis, skyVp.w, skyVp.h],
  );

  const skyPanLast = useRef<{ x: number; y: number } | null>(null);
  const skyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          data != null && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
        onPanResponderGrant: (e) => {
          skyPanLast.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
        },
        onPanResponderMove: (e) => {
          if (skyPanLast.current == null) return;
          const x = e.nativeEvent.pageX;
          const y = e.nativeEvent.pageY;
          const dx = x - skyPanLast.current.x;
          const dy = y - skyPanLast.current.y;
          skyPanLast.current = { x, y };
          // 가로: 손가락 방향으로 둘러보기(왼쪽으로 끌면 오른쪽 별이 왼쪽으로 이동)
          setViewYawDeg((deg) => normYaw(deg - dx * VIEW_YAW_GAIN));
          // 세로: 아래로 끌면 더 위를 올려다봄(고도↑). 0°(지평선)~90°(천정)로 제한
          setViewPitchDeg((deg) =>
            clampNum(deg + dy * VIEW_PITCH_GAIN, VIEW_ALT_MIN, VIEW_ALT_MAX),
          );
        },
        onPanResponderRelease: () => {
          skyPanLast.current = null;
        },
        onPanResponderTerminate: () => {
          skyPanLast.current = null;
        },
      }),
    [data],
  );

  const hasObserver =
    obsLat != null && obsLng != null && Number.isFinite(obsLat) && Number.isFinite(obsLng);

  /** 관측 시각·관측자 위치 → 태양 고도 (한국 낮/밤 하늘 색에 사용) */
  const observeDate = useMemo(() => new Date(observeAtIso), [observeAtIso]);
  const sunAltAzForSky = useMemo(() => {
    if (!data || !hasObserver || obsLat == null || obsLng == null) return null;
    return sunAltAzDeg(observeDate, obsLat, obsLng);
  }, [data, hasObserver, observeDate, obsLat, obsLng]);

  const skyBackdrop = useMemo(
    () => skyBackdropFromSunAlt(sunAltAzForSky?.altDeg ?? -90),
    [sunAltAzForSky],
  );

  /** HIP 카탈로그 이름 별 — RN 레이어 라벨(GL/SVG 공통). 겹침은 layoutNamedStarLabels로 분산. */
  const namedStarOverlayLayout = useMemo(() => {
    if (!data || skyVp.w <= 0 || skyVp.h <= 0) return [];
    const anchors: LabelAnchor[] = [];
    for (const s of data.stars) {
      if (!s.visible) continue;
      const ko = namedStarLabelKo(s.hip);
      if (!ko) continue;
      const px = projectOverlayPx(s.azDeg, s.altDeg);
      if (!px) continue;
      anchors.push({
        id: String(s.hip),
        anchorX: px.x,
        anchorY: px.y + 7,
        label: ko,
        mag: s.mag,
      });
    }
    return layoutNamedStarLabels(anchors);
  }, [data, skyVp.w, skyVp.h, projectOverlayPx]);

  /** 겹칠 때 어두운 별이 위 레이어를 받도록 시각등급 내림차순 */
  const starHitTargets = useMemo(() => {
    if (!data || skyVp.w <= 0 || skyVp.h <= 0) return [];
    const half = STAR_HIT_PX / 2;
    const rows: Array<{ star: SkyViewStarDto; left: number; top: number }> = [];
    for (const s of data.stars) {
      if (!s.visible) continue;
      const px = projectOverlayPx(s.azDeg, s.altDeg);
      if (!px) continue;
      rows.push({ star: s, left: px.x - half, top: px.y - half });
    }
    rows.sort((a, b) => b.star.mag - a.star.mag);
    return rows;
  }, [data, skyVp.w, skyVp.h, projectOverlayPx]);

  /**
   * 지평선 전경(캠핑 명소): 평평한 땅 + 나무·텐트·불빛 실루엣. 시선 고도(viewAlt)에 따라
   * 정면(0°)에선 하단 ~1/4를 차지하고, 위로 올려다볼수록 아래로 내려가며 옅어져 사라진다.
   * 좌우로 돌리면 전경이 가로로 흐른다(시차). 땅은 평평하다 — 이미 언덕 위라는 설정.
   */
  const groundScene = useMemo(() => {
    if (!data) return null;
    // 위로 올려다볼수록 옅어짐: 정면 또렷 → 40°↑ 하늘만(지평선은 그 전에 화면 아래로)
    const fade = clampNum((40 - viewAlt) / 22, 0, 1);
    if (fade <= 0.02) return null;
    const horizonY = CAMP_HORIZON_BASE + viewAlt * CAMP_HORIZON_SLOPE;
    // 좌우로 돌면 전경도 흐른다(지평선 부근 별 이동량과 비슷). 0~CAMP_TILE 로 래핑
    const offset = (viewAz * 0.5) % CAMP_TILE;
    const scroll = -offset;
    // 현재 스크롤된 타일 수(연속). 변종(텐트 디자인)을 이 index로 정해 북쪽을 넘어
    // 한 바퀴 돌아도(360°=2타일) 같은 방향엔 늘 같은 캠프가 보이게 한다.
    const worldTile = Math.floor((viewAz * 0.5) / CAMP_TILE);
    return { fade, horizonY, scroll, worldTile };
  }, [data, viewAlt, viewAz]);

  const yawDelta = Math.abs(((viewYawDeg - VIEW_DEFAULT_YAW + 540) % 360) - 180);
  const viewIsDefault =
    yawDelta < 0.6 && Math.abs(viewPitchDeg - VIEW_DEFAULT_PITCH) < 0.6;
  /** 시선이 천정(수직)에 도달 — UI로 알려줌 */
  const atZenith = viewAlt >= 89.5;

  /** 하늘 그라데이션의 지평선(따뜻한 색) 위치를 전경 지평선에 맞춤 — 시선 올리면 함께 내려감 */
  const skyHorizonPct = clampNum(
    CAMP_HORIZON_BASE + viewAlt * CAMP_HORIZON_SLOPE,
    48,
    100,
  );
  const skyMidPct = Math.min(46, skyHorizonPct * 0.58);

  const kstPrimary = formatKstFull(observeAtIso);
  const utcNote = formatUtcFootnote(observeAtIso);

  const win = Dimensions.get('window');
  const stageW = skyStage.w > 0 ? skyStage.w : win.width;
  const stageH = skyStage.h > 0 ? skyStage.h : win.height;
  /** Screen SafeAreaView 안이므로 insets.top 중복 적용하지 않음 */
  const skyOverlayTop = spacing.xs;
  const controlsMaxW = Math.min(168, Math.max(120, stageW * 0.42));

  const skySvg = data ? (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="auto"
    >
      <Defs>
        <LinearGradient
          id="dynSkyMain"
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor={skyBackdrop.zenith} />
          <Stop offset={`${skyMidPct.toFixed(1)}%`} stopColor={skyBackdrop.mid} />
          <Stop offset={`${skyHorizonPct.toFixed(1)}%`} stopColor={skyBackdrop.horizon} />
          <Stop offset="100%" stopColor={skyBackdrop.horizon} />
        </LinearGradient>
        <RadialGradient
          id="zenithCool"
          cx="50"
          cy="8"
          rx="58"
          ry="44"
          fx="50"
          fy="4"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#182458" stopOpacity="0.42" />
          <Stop offset="100%" stopColor="#182458" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient
          id="milkyWayBand"
          x1="8"
          y1="82"
          x2="92"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#5860a0" stopOpacity="0" />
          <Stop offset="38%" stopColor="#8890c8" stopOpacity="0.075" />
          <Stop offset="52%" stopColor="#9098d0" stopOpacity="0.095" />
          <Stop offset="100%" stopColor="#5860a0" stopOpacity="0" />
        </LinearGradient>
        {/* 캠프 불빛이 번지는 따뜻한 광원 — 텐트 주변/랜턴 */}
        <RadialGradient id="campGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor="#ffb061" stopOpacity="0.5" />
          <Stop offset="55%" stopColor="#ff8a3d" stopOpacity="0.16" />
          <Stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
        </RadialGradient>
        {/* 텐트 입구에서 새어 나오는 빛 */}
        <RadialGradient id="tentGlow" cx="50%" cy="100%" rx="75%" ry="100%">
          <Stop offset="0%" stopColor="#ffe0a6" stopOpacity="0.95" />
          <Stop offset="60%" stopColor="#ffac55" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* 하늘 배경·은하 — 태양 고도(관측 시각·위치)에 따라 낮/황혼/밤. 시선 이동과 무관한 분위기 레이어 */}
      <Rect x="0" y="0" width="100" height="100" fill="url(#dynSkyMain)" />
      <Rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="url(#zenithCool)"
        opacity={skyBackdrop.zenithCoolOpacity}
      />
      <Rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="url(#milkyWayBand)"
        opacity={skyBackdrop.milkyOpacity}
      />
      {/* 별·태양·별선·행성 — 시선(viewAz/viewAlt) 기준 1인칭 투영 */}
      {sunAltAzForSky
        ? (() => {
            const p = projectToView(
              sunAltAzForSky.azDeg,
              sunAltAzForSky.altDeg,
              viewBasis,
            );
            if (!p.visible) return null;
            return <SunGlyph nx={p.nx} ny={p.ny} altDeg={sunAltAzForSky.altDeg} />;
          })()
        : null}
      {lineSegments.map((seg, i) => {
        const a = starsByHip.get(seg.fromHip);
        const b = starsByHip.get(seg.toHip);
        if (!a?.visible || !b?.visible) return null;
        const pa = projectToView(a.azDeg, a.altDeg, viewBasis);
        const pb = projectToView(b.azDeg, b.altDeg, viewBasis);
        if (!pa.visible || !pb.visible) return null;
        return (
          <Line
            key={`${seg.fromHip}-${seg.toHip}-${i}`}
            x1={pa.nx}
            y1={pa.ny}
            x2={pb.nx}
            y2={pb.ny}
            stroke="#c4b8e8"
            strokeOpacity={skyBackdrop.lineOpacity}
            strokeWidth={0.4}
          />
        );
      })}
      {data.stars
        .filter((s) => s.visible)
        .map((s) => {
          const p = projectToView(s.azDeg, s.altDeg, viewBasis);
          if (!p.visible) return null;
          return (
            <CompactStarGlyph
              key={s.hip}
              nx={p.nx}
              ny={p.ny}
              mag={s.mag}
              opacityScale={skyBackdrop.starOpacity}
            />
          );
        })}
      {(data.bodies ?? [])
        .filter((b: SkyViewBodyDto) => b.visible)
        .map((b: SkyViewBodyDto) => {
          const p = projectToView(b.azDeg, b.altDeg, viewBasis);
          if (!p.visible) return null;
          return <CelestialBodyMarker key={b.id} nx={p.nx} ny={p.ny} body={b} />;
        })}
      {/* 지평선 전경(캠핑 명소): 평평한 땅 한 겹 + 가로로 타일링되는 나무·텐트·불빛.
          실루엣은 낮에도 선명하게(투명도는 시선 고도 페이드만), 불빛은 lightOpacity로 낮엔 꺼짐 */}
      {groundScene ? (
        <G opacity={groundScene.fade}>
          <Rect
            x={0}
            y={groundScene.horizonY}
            width={100}
            height={150 - groundScene.horizonY}
            fill={skyBackdrop.campGround}
          />
          {[-1, 0, 1, 2].map((k) => (
            <G
              key={`camp-${k}`}
              transform={`translate(${(groundScene.scroll + k * CAMP_TILE).toFixed(2)} 0)`}
            >
              <CampSceneTile
                y={groundScene.horizonY}
                variant={(((groundScene.worldTile + k) % 2) + 2) % 2}
                lightOpacity={skyBackdrop.lightOpacity}
                colors={{
                  pine: skyBackdrop.campPine,
                  trunk: skyBackdrop.campTrunk,
                  tent: skyBackdrop.campTent,
                  accent: skyBackdrop.campTentAccent,
                }}
              />
            </G>
          ))}
        </G>
      ) : null}
      {data.constellationLabels.map((lb, idx) => {
        const p = projectToView(lb.azDeg, lb.altDeg, viewBasis);
        if (!p.visible) return null;
        const nx = p.nx;
        const label = CON_LABEL_KO[lb.con] ?? lb.con;
        const ly = p.ny - 4;
        return (
          <SvgText
            key={`${lb.con}-${idx}`}
            x={nx}
            y={ly}
            fill="#ffeccd"
            stroke="#120818"
            strokeWidth={0.22}
            strokeOpacity={0.4}
            fontSize={2.88}
            fontWeight="500"
            fontFamily={
              Platform.OS === 'ios'
                ? 'Helvetica Neue'
                : Platform.OS === 'android'
                  ? 'sans-serif'
                  : undefined
            }
            letterSpacing={0.2}
            textAnchor="middle"
            opacity={skyBackdrop.labelOpacity}
            pointerEvents="none"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  ) : null;

  /** SVG Text onPress는 기기별로 불안정해서, 동일 좌표에 RN Pressable 오버레이 — GL/SVG 공통 */
  const constellationHitOverlay =
    data && skyVp.w > 0 && skyVp.h > 0 ? (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
        {data.constellationLabels.map((lb, idx) => {
          const px = projectOverlayPx(lb.azDeg, lb.altDeg);
          if (!px) return null;
          const { x, y } = px;
          const labelKo = CON_LABEL_KO[lb.con] ?? lb.con;
          return (
            <Pressable
              key={`con-hit-${lb.con}-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={`${labelKo} 별자리 운세`}
              onPress={() => setOverlaySheet({ kind: 'constellation', con: lb.con, labelKo })}
              style={{ position: 'absolute', left: x - 44, top: y - 14, width: 88, height: 30 }}
            />
          );
        })}
      </View>
    ) : null;

  const starHitOverlay =
    data && skyVp.w > 0 && skyVp.h > 0 && starHitTargets.length > 0 ? (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
        {starHitTargets.map(({ star: s, left, top }) => {
          const title = namedStarLabelKo(s.hip) ?? s.name ?? `HIP ${s.hip}`;
          return (
            <Pressable
              key={`star-hit-${s.hip}`}
              accessibilityRole="button"
              accessibilityLabel={`별 정보 ${title}`}
              onPress={() => setOverlaySheet({ kind: 'star', star: s })}
              style={{ position: 'absolute', left, top, width: STAR_HIT_PX, height: STAR_HIT_PX }}
            />
          );
        })}
      </View>
    ) : null;

  const locDenied =
    Platform.OS !== 'web' &&
    locationPermissionStatus === Location.PermissionStatus.DENIED;

  const controlsPanel =
    hasObserver && data ? (
      <View
        style={[StyleSheet.absoluteFillObject, styles.controlsTouchPassthrough]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.controlsFloat,
            {
              top: skyOverlayTop,
              left: spacing.sm,
              maxWidth: controlsMaxW,
            },
          ]}
          pointerEvents="auto"
        >
        <GlassCard glow padding={10} style={styles.controlsFloatInner}>
          <Pressable
            onPress={() => persistControlsExpanded(!controlsExpanded)}
            style={({ pressed }) => [
              styles.controlsHeaderRow,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={controlsExpanded ? '천구 패널 접기' : '천구 패널 펼치기'}
          >
            <Text style={[styles.controlsHeaderTitle, { color: theme.foreground }]}>
              천구 · 관측
            </Text>
            <Text style={[styles.controlsHeaderChevron, { color: theme.starGold }]}>
              {controlsExpanded ? '▼' : '▶'}
            </Text>
          </Pressable>

          {!controlsExpanded ? (
            <View style={styles.controlsCompact}>
              <Text style={[styles.controlsCompactTime, { color: theme.foreground }]}>
                {formatKstHm(observeAtIso)} KST
              </Text>
              {locSiLoading ? (
                <Text style={[styles.controlsCompactMeta, { color: theme.mutedForeground }]}>
                  SI …
                </Text>
              ) : locSiDisplay != null ? (
                <Text
                  style={[
                    styles.controlsCompactMeta,
                    {
                      color: locSiDisplay.measurable
                        ? theme.starGold
                        : theme.destructive,
                    },
                  ]}
                >
                  SI {locSiDisplay.label}
                </Text>
              ) : locSiErr ? (
                <Text style={[styles.controlsCompactMeta, { color: theme.destructive }]} numberOfLines={1}>
                  SI 오류
                </Text>
              ) : (
                <Text style={[styles.controlsCompactMeta, { color: theme.mutedForeground }]}>
                  SI —
                </Text>
              )}
              <Text style={[styles.controlsCompactMeta, { color: theme.mutedForeground }]}>
                {renderEngine === 'svg' ? 'SVG' : 'GL'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.controlsTime, { color: theme.foreground }]} numberOfLines={1}>
                {kstPrimary}
              </Text>
              <Text style={[styles.controlsUtc, { color: theme.mutedForeground }]} numberOfLines={1}>
                {utcNote}
              </Text>
              {Platform.OS !== 'web' &&
              locationFeaturesEnabled &&
              locationPermissionStatus != null &&
              locationPermissionStatus !== Location.PermissionStatus.GRANTED ? (
                <View style={{ marginTop: 8, gap: 6 }}>
                  <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                    위치를 허용하면 천구·Star-Index가 현재 좌표를 씁니다.
                  </Text>
                  {!locDenied ? (
                    <Button
                      label="위치 권한 허용"
                      variant="secondary"
                      size="sm"
                      onPress={() => void onRequestLocationPermission?.()}
                    />
                  ) : (
                    <Button
                      label="설정에서 위치 켜기"
                      variant="outline"
                      size="sm"
                      onPress={() => void Linking.openSettings()}
                    />
                  )}
                </View>
              ) : null}
              <Text style={[styles.renderModeLabel, { color: theme.mutedForeground, marginTop: 8 }]}>
                이 위치 Star-Index
              </Text>
              {locSiLoading ? (
                <Text style={{ color: theme.mutedForeground, fontSize: 10, marginTop: 4 }}>
                  점수 불러오는 중…
                </Text>
              ) : locSiErr ? (
                <Text
                  style={{ color: theme.destructive, fontSize: 10, marginTop: 4 }}
                  numberOfLines={4}
                >
                  {locSiErr}
                </Text>
              ) : locSiDisplay && locStarIndex != null ? (
                <View style={{ marginTop: 4 }}>
                  <Text
                    style={{
                      color: locSiDisplay.measurable
                        ? theme.starGold
                        : theme.destructive,
                      fontSize: locSiDisplay.measurable ? 22 : 16,
                      fontFamily: 'SpaceMono-Regular',
                      fontWeight: '700',
                    }}
                  >
                    {locSiDisplay.label}
                  </Text>
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 9,
                      marginTop: 4,
                      lineHeight: 13,
                    }}
                    numberOfLines={5}
                  >
                    {locStarIndex.name}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.row, { marginTop: 8 }]}>
                <Button label="−6h" variant="outline" size="sm" onPress={() => onShiftHours(-6)} />
                <Button label="−1h" variant="outline" size="sm" onPress={() => onShiftHours(-1)} />
                <Button label="지금" variant="secondary" size="sm" onPress={onObserveNow} />
                <Button label="+1h" variant="outline" size="sm" onPress={() => onShiftHours(1)} />
                <Button label="+6h" variant="outline" size="sm" onPress={() => onShiftHours(6)} />
              </View>
              <View style={[styles.row, { marginTop: 8 }]}>
                <Button
                  label={alignHeading ? '방위 끄기' : '방위 맞춤'}
                  variant={alignHeading ? 'secondary' : 'outline'}
                  size="sm"
                  onPress={() => setAlignHeading((v) => !v)}
                />
                <Button
                  label={motionAssist ? '자이로 끄기' : '자이로'}
                  variant={motionAssist ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={!alignHeading}
                  onPress={() => setMotionAssist((v) => !v)}
                />
              </View>
              <Text style={[styles.renderModeLabel, { color: theme.mutedForeground }]}>천구 렌더</Text>
              {renderEngine === 'svg' ? (
                <Text style={[styles.constellationTapHint, { color: theme.mutedForeground }]}>
                  화면의 별자리 이름을 누르면 운세·이야기를 볼 수 있어요.
                </Text>
              ) : null}
              <View style={{ marginTop: 8 }}>
                <Button
                  label="시야 원위치"
                  variant="outline"
                  size="sm"
                  disabled={viewIsDefault}
                  onPress={() => {
                    setViewYawDeg(VIEW_DEFAULT_YAW);
                    setViewPitchDeg(VIEW_DEFAULT_PITCH);
                  }}
                />
                {!viewIsDefault ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 9,
                      marginTop: 6,
                      lineHeight: 13,
                    }}
                  >
                    화면을 드래그해 시선을 돌려 본 상태입니다(좌우=방위, 위아래=고도). 버튼으로 처음
                    방향으로 돌아갑니다.
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.renderModeRow,
                  { borderColor: theme.borderSubtle, backgroundColor: theme.card },
                ]}
              >
                <Pressable
                  onPress={() => persistRenderEngine('svg')}
                  style={({ pressed }) => [
                    styles.renderModeSeg,
                    renderEngine === 'svg' && {
                      backgroundColor: theme.input,
                      borderColor: theme.starGold,
                    },
                    { borderColor: theme.borderSubtle },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text style={[styles.renderModeTitle, { color: theme.foreground }]}>고해상도 SVG</Text>
                  <Text style={[styles.renderModeSub, { color: theme.mutedForeground }]}>
                    라벨 · 별자리 · 벡터
                  </Text>
                </Pressable>
                <Pressable
                  disabled={Platform.OS === 'web'}
                  onPress={() => persistRenderEngine('gl')}
                  style={({ pressed }) => [
                    styles.renderModeSeg,
                    renderEngine === 'gl' && {
                      backgroundColor: theme.input,
                      borderColor: theme.starGold,
                    },
                    { borderColor: theme.borderSubtle },
                    Platform.OS === 'web' && { opacity: 0.45 },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text style={[styles.renderModeTitle, { color: theme.foreground }]}>GPU OpenGL</Text>
                  <Text style={[styles.renderModeSub, { color: theme.mutedForeground }]}>
                    텍스처 은하 · 실시간
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.row, { marginTop: 8 }]}>
                <Button
                  label="새로고침"
                  variant="ghost"
                  size="sm"
                  onPress={() => void load()}
                  disabled={loading}
                />
              </View>
              {!skyUsesGps && spotFallback ? (
                <Text style={[styles.hint, { color: theme.mutedForeground, marginTop: 8 }]}>
                  명소 좌표 기준 · GPS 켜면 현재 위치로 전환
                </Text>
              ) : null}
              {Platform.OS === 'web' ? (
                <Text style={[styles.hint, { color: theme.mutedForeground, marginTop: 6 }]}>
                  웹에서는 나침반 미지원
                </Text>
              ) : null}
              {headingErr ? (
                <Text style={{ color: theme.destructive, fontSize: 10, marginTop: 6 }}>{headingErr}</Text>
              ) : null}
              {alignHeading && headingDeg != null && Platform.OS !== 'web' ? (
                <Text style={[styles.hint, { color: theme.mutedForeground, marginTop: 4 }]}>
                  방위 {headingDeg.toFixed(0)}°
                  {motionAssist ? ' · 자이로' : ''}
                </Text>
              ) : null}
            </>
          )}
        </GlassCard>
        </View>
        <Text
          pointerEvents="none"
          style={[
            styles.skyMetaFloat,
            {
              color: theme.mutedForeground,
              bottom: Math.max(insets.bottom, 10) + 2,
            },
          ]}
          numberOfLines={2}
        >
          LST {data.lstDeg.toFixed(1)}° · JD {data.jd.toFixed(4)} · 별{' '}
          {data.stars.filter((s) => s.visible).length}/{data.stars.length}
          {data.ephemerisSource ? ` · ${data.ephemerisSource}` : ''}
        </Text>
      </View>
    ) : null;

  const constellationLoreOpen =
    overlaySheet?.kind === 'constellation' ? getConstellationLore(overlaySheet.con) : null;

  return (
    <View
      style={[styles.root, { backgroundColor: theme.background }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSkyStage({ w: width, h: height });
      }}
    >
      {!hasObserver ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: theme.foreground }]}>가상 밤하늘</Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>
            위치를 잡으면 천구가 화면을 채웁니다. 명소는 MAIN의 주간 TOP3에서 고를 수 있어요.
          </Text>
          {Platform.OS !== 'web' &&
          locationFeaturesEnabled &&
          locationPermissionStatus != null &&
          locationPermissionStatus !== Location.PermissionStatus.GRANTED ? (
            <Card title="위치 권한" description="천구·Star-Index에 현재 좌표를 쓰려면 필요합니다">
              <Text style={{ color: theme.mutedForeground, fontSize: 13, marginBottom: 10 }}>
                {locDenied
                  ? '이전에 거부하셨다면 시스템 설정에서 위치를 켜 주세요.'
                  : '아래에서 허용하면 OS 위치 권한 창이 뜹니다.'}
              </Text>
              {!locDenied ? (
                <Button
                  label="위치 권한 허용"
                  variant="secondary"
                  onPress={() => void onRequestLocationPermission?.()}
                />
              ) : (
                <Button
                  label="설정 열기"
                  variant="outline"
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </Card>
          ) : null}
          <Card
            title="관측 위치 필요"
            description="위치 권한을 허용하거나 MAIN·지도에서 명소를 고르세요"
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
              GPS가 꺼져 있으면 기본 명소나 MAIN TOP3 좌표로 천구를 그립니다.
            </Text>
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.skyStage}>
          {loading && !data ? (
            <ActivityIndicator color={theme.starGold} style={{ marginTop: 24 }} />
          ) : null}
          {err ? <Text style={{ color: theme.destructive, padding: 16, textAlign: 'center' }}>{err}</Text> : null}
          {data ? (
            <View
              collapsable={false}
              style={styles.skyViewportFill}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setSkyVp((prev) =>
                    prev.w === width && prev.h === height ? prev : { w: width, h: height },
                  );
                }
              }}
              {...skyPanResponder.panHandlers}
            >
              {useGlView && skyVp.w > 0 && skyVp.h > 0 ? (
                <SkyGlCanvas
                  layoutWidth={skyVp.w}
                  layoutHeight={skyVp.h}
                  hideCaption
                  viewBasis={viewBasis}
                  data={data}
                  lineSegments={lineSegments}
                  starsByHip={starsByHip}
                  starColorHex="#f0f4ff"
                  lineColorHex="#c4b8e8"
                  bodyPlanetHex="#f4e6d8"
                  bodyMoonHex="#fff6dc"
                  sunAltAz={sunAltAzForSky}
                />
              ) : !useGlView ? (
                <View style={{ flex: 1, position: 'relative' }}>{skySvg}</View>
              ) : (
                <View style={styles.glPlaceholder} />
              )}
              {starHitOverlay}
              {namedStarOverlayLayout.length > 0 ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {namedStarOverlayLayout.map(({ id, label, left, top }) => (
                    <View
                      key={`named-star-${id}`}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        maxWidth: 240,
                      }}
                    >
                      <Text
                        style={{
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: '600',
                          color: '#ffeccd',
                          opacity: skyBackdrop.labelOpacity * 0.95,
                          textShadowColor: 'rgba(8,6,20,0.85)',
                          textShadowOffset: { width: 0, height: 0.5 },
                          textShadowRadius: 2,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {constellationHitOverlay}
            </View>
          ) : null}

          {data && atZenith ? (
            <View pointerEvents="none" style={styles.zenithBadgeWrap}>
              <View
                style={[
                  styles.zenithBadge,
                  { borderColor: theme.starGold, backgroundColor: 'rgba(6,8,18,0.66)' },
                ]}
              >
                <Text style={[styles.zenithBadgeText, { color: theme.starGold }]}>
                  천정 · 90°
                </Text>
                <Text style={[styles.zenithBadgeSub, { color: theme.mutedForeground }]}>
                  머리 위를 보는 중
                </Text>
              </View>
            </View>
          ) : null}

          {data ? controlsPanel : null}
        </View>
      )}
      <Modal
        visible={overlaySheet != null}
        transparent
        animationType="slide"
        onRequestClose={() => setOverlaySheet(null)}
      >
        {overlaySheet ? (
          <View style={styles.sheetOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={() => setOverlaySheet(null)}
            />
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                },
              ]}
            >
              <View style={[styles.sheetGrab, { backgroundColor: theme.borderSubtle }]} />
              {overlaySheet.kind === 'constellation' ? (
                <>
                  <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
                    {overlaySheet.labelKo}
                  </Text>
                  <Text style={[styles.sheetSection, { color: theme.starGold }]}>별자리 운세</Text>
                  <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetScrollInner}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[styles.sheetBody, { color: theme.foreground }]}>
                      {constellationLoreOpen?.fortune}
                    </Text>
                    <Text style={[styles.sheetSection, { color: theme.starGold, marginTop: 18 }]}>
                      이야기
                    </Text>
                    <Text style={[styles.sheetStory, { color: theme.mutedForeground }]}>
                      {constellationLoreOpen?.story}
                    </Text>
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
                    {namedStarLabelKo(overlaySheet.star.hip) ??
                      overlaySheet.star.name ??
                      `HIP ${overlaySheet.star.hip}`}
                  </Text>
                  {overlaySheet.star.name ? (
                    <Text
                      style={{
                        color: theme.mutedForeground,
                        marginTop: 4,
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {overlaySheet.star.name}
                    </Text>
                  ) : null}
                  <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetScrollInner}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[styles.sheetSection, { color: theme.starGold, marginTop: 8 }]}>
                      관측 정보
                    </Text>
                    <Text style={[styles.sheetBody, { color: theme.foreground }]}>
                      별자리: {CON_LABEL_KO[overlaySheet.star.con] ?? overlaySheet.star.con}
                      {'\n'}
                      시각등급: {overlaySheet.star.mag.toFixed(2)} 등급
                      {'\n'}
                      방위·고도: {overlaySheet.star.azDeg.toFixed(1)}° ·{' '}
                      {overlaySheet.star.altDeg.toFixed(1)}°
                      {'\n'}
                      HIP: {overlaySheet.star.hip}
                    </Text>
                    <Text style={[styles.sheetSection, { color: theme.starGold, marginTop: 18 }]}>
                      거리
                    </Text>
                    <Text style={[styles.sheetBody, { color: theme.mutedForeground }]}>
                      {formatStarDistanceLyAu(overlaySheet.star.distanceLy)}
                    </Text>
                    <Text
                      style={[
                        styles.sheetStory,
                        { color: theme.mutedForeground, marginTop: 12, fontSize: 11, lineHeight: 16 },
                      ]}
                    >
                      거리는 밝은 별 목록에 넣은 정적 대표값(광년)입니다. AU 표기는 같은 시선 거리를
                      태양–지구 거리로 나눈 스케일이며, 항성까지의 실제 물리 거리는 광년이 더 직관적입니다.
                    </Text>
                  </ScrollView>
                </>
              )}
              <Button
                label="닫기"
                variant="secondary"
                fullWidth
                onPress={() => setOverlaySheet(null)}
              />
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skyStage: {
    flex: 1,
    minHeight: 0,
  },
  /** 탭 콘텐츠 영역 거의 전체 — 스타렐리움식 풀스크린에 가깝게 */
  skyViewportFill: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    overflow: 'hidden',
    borderRadius: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  glPlaceholder: { flex: 1, minHeight: 120 },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 120, paddingRight: 120 },
  top3FloatWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  top3FloatCard: {
    backgroundColor: 'rgba(6, 8, 18, 0.4)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  top3FloatLabel: {
    fontSize: 9,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  top3RowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  top3Rank: {
    fontSize: 14,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '700',
    minWidth: 16,
  },
  top3Score: {
    fontSize: 11,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '600',
    flexShrink: 0,
  },
  top3Name: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 14,
  },
  /** 천구 위에 얹되, 패널 밖 터치는 아래 SVG로 통과 */
  controlsTouchPassthrough: {
    zIndex: 4,
  },
  controlsFloat: {
    position: 'absolute',
    zIndex: 5,
    left: 0,
  },
  controlsFloatInner: {
    maxWidth: '100%',
  },
  controlsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2,
  },
  controlsHeaderTitle: {
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  controlsHeaderChevron: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
  controlsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 2,
  },
  controlsCompactTime: {
    fontSize: 11,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '600',
  },
  controlsCompactMeta: {
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '600',
  },
  controlsTime: {
    fontSize: 11,
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '600',
  },
  controlsUtc: {
    fontSize: 8,
    marginTop: 2,
    fontFamily: 'SpaceMono-Regular',
    opacity: 0.85,
  },
  zenithBadgeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  zenithBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
  },
  zenithBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.6,
  },
  zenithBadgeSub: {
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  skyMetaFloat: {
    position: 'absolute',
    alignSelf: 'center',
    left: 12,
    right: 12,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'SpaceMono-Regular',
    zIndex: 5,
    opacity: 0.9,
  },
  title: { fontSize: 20, fontFamily: 'SpaceMono-Regular', marginBottom: 6 },
  sub: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  hint: { fontSize: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  renderModeLabel: {
    fontSize: 9,
    fontFamily: 'SpaceMono-Regular',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  renderModeRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    gap: 0,
  },
  renderModeSeg: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    margin: 4,
  },
  renderModeTitle: { fontSize: 11, fontWeight: '700' },
  renderModeSub: { fontSize: 9, marginTop: 2, lineHeight: 12 },
  constellationTapHint: {
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 6,
    opacity: 0.9,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '78%',
  },
  sheetGrab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'SpaceMono-Regular',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  sheetSection: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
    fontFamily: 'SpaceMono-Regular',
  },
  sheetScroll: { maxHeight: 360 },
  sheetScrollInner: { paddingBottom: 12 },
  sheetBody: { fontSize: 15, lineHeight: 24 },
  sheetStory: { fontSize: 14, lineHeight: 23 },
});

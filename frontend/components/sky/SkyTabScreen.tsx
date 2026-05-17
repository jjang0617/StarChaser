import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Accelerometer, Gyroscope } from 'expo-sensors';
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
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../../themes/ThemeContext';
import type { WeeklyTop5ItemDto } from '../../lib/types/api';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import { Button, Card } from '../ui';
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
  azAltToNorm,
  magToRadius,
  normToLayoutSlice,
  rotateSkyNorm,
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
  /** expo-location 전경 위치 권한(null이면 아직 조회 전) */
  locationPermissionStatus?: Location.PermissionResponse['status'] | null;
  /** 위치 권한 시스템 다이얼로그 재요청 */
  onRequestLocationPermission?: () => void | Promise<void>;
  top5Loading: boolean;
  top5Error: string | null;
  top5Items: WeeklyTop5ItemDto[] | null;
  selectedSpotId: string | null;
  onSelectTop5Spot: (spotId: string) => void;
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

/** 스타렐리움식 지평선 위 나무·언덕 실루엣(회전 천구 위에 덮어 별이 지평선 아래 가려짐) */
const STELLARIUM_HILL_BASE =
  'M0,100 L0,93 Q12,90 28,91 Q42,88 50,90 Q62,87 78,90 Q90,88 100,91 L100,100 Z';
const STELLARIUM_TREE_LINE =
  'M0,100 L0,91 L4,92 L7,87 L11,89 L14,84 L18,86 L22,81 L27,84 L31,79 L36,82 L42,76 L48,80 L55,73 L62,78 L68,74 L75,77 L82,71 L90,75 L96,70 L100,73 L100,100 Z';
const STELLARIUM_BOKEH = [
  { cx: 78, cy: 94.5, r: 1.15, o: 0.45 },
  { cx: 86, cy: 93.2, r: 0.85, o: 0.38 },
  { cx: 72, cy: 95.8, r: 0.7, o: 0.32 },
  { cx: 91, cy: 95.5, r: 1.6, o: 0.18 },
  { cx: 83, cy: 96.8, r: 0.9, o: 0.28 },
] as const;

const SKY_RENDER_STORAGE_KEY = 'starChaser:skyRenderMode';
const SKY_CONTROLS_EXPANDED_KEY = 'starChaser:skyControlsExpanded';

const HEADING_LOWPASS = 0.88;
/** 자이로 보조 시 나침반에 가끔 붙는 가중(드리프트 억제) */
const COMPASS_BLEND_MOTION = 0.07;
/** 가속도계 롤 → 천구 회전에 더하는 비율(세로 기기 기준 실험값) */
const TILT_GAIN = 0.09;

export function SkyTabScreen({
  observerLat,
  observerLng,
  observerSpotId,
  observeAtIso,
  onShiftHours,
  onObserveNow,
  onSessionInvalidated,
  skyUsesGps,
  locationPermissionStatus = null,
  onRequestLocationPermission,
  top5Loading,
  top5Error,
  top5Items,
  selectedSpotId,
  onSelectTop5Spot,
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
  const [tiltRollDeg, setTiltRollDeg] = useState(0);
  /**
   * 손가락 가로 드래그로 “고개를 돌린 것처럼” 별·은하·별선만 방위 이동(°).
   * 지평 실루엣·나침반 정렬(skyRotation)은 그대로 둠.
   */
  const [viewAzPanDeg, setViewAzPanDeg] = useState(0);
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
    setViewAzPanDeg(0);
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
      setTiltRollDeg(0);
      if (wasMotion && headingDeg != null) {
        headingSmoothRef.current = headingDeg;
      }
    } else if (!wasMotion && headingDeg != null) {
      fusedHeadingRef.current = headingDeg;
    }
    prevMotionAssistRef.current = motionAssist;
  }, [motionAssist, headingDeg]);

  useEffect(() => {
    if (!alignHeading || Platform.OS === 'web') {
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
  }, [alignHeading, motionAssist]);

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

  useEffect(() => {
    if (!alignHeading || !motionAssist || Platform.OS === 'web') {
      return;
    }
    Accelerometer.setUpdateInterval(Platform.OS === 'android' ? 200 : 50);
    const sub = Accelerometer.addListener((a) => {
      const roll = (Math.atan2(a.x, a.y) * 180) / Math.PI;
      setTiltRollDeg(roll);
    });
    return () => sub.remove();
  }, [alignHeading, motionAssist]);

  const starsByHip = useMemo(() => {
    const m = new Map<number, SkyViewStarDto>();
    if (!data) return m;
    for (const s of data.stars) m.set(s.hip, s);
    return m;
  }, [data]);

  /** 나침반 = 자북에서 기기 상단까지 시계방향° → 천구 도표는 반시계 보정. 자이로 보조 시 가속도 롤을 소량 가산 */
  const skyRotation =
    alignHeading && Platform.OS !== 'web' && headingDeg != null
      ? -headingDeg + (motionAssist ? tiltRollDeg * TILT_GAIN : 0)
      : 0;

  const celestialRot = skyRotation + viewAzPanDeg;

  const skyPanLastX = useRef<number | null>(null);
  const skyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          data != null &&
          Math.abs(g.dx) > 16 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 0.65,
        onPanResponderGrant: (e) => {
          skyPanLastX.current = e.nativeEvent.pageX;
        },
        onPanResponderMove: (e) => {
          if (skyPanLastX.current == null) return;
          const x = e.nativeEvent.pageX;
          const dx = x - skyPanLastX.current;
          skyPanLastX.current = x;
          setViewAzPanDeg((deg) => deg + dx * 0.32);
        },
        onPanResponderRelease: () => {
          skyPanLastX.current = null;
        },
        onPanResponderTerminate: () => {
          skyPanLastX.current = null;
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
      const base = azAltToNorm(s.azDeg, s.altDeg);
      const { nx, ny } = rotateSkyNorm(base.nx, base.ny, celestialRot);
      const { x, y } = normToLayoutSlice(nx, ny, skyVp.w, skyVp.h);
      anchors.push({
        id: String(s.hip),
        anchorX: x,
        anchorY: y + 7,
        label: ko,
        mag: s.mag,
      });
    }
    return layoutNamedStarLabels(anchors);
  }, [data, skyVp.w, skyVp.h, celestialRot]);

  /** 겹칠 때 어두운 별이 위 레이어를 받도록 시각등급 내림차순 */
  const starHitTargets = useMemo(() => {
    if (!data || skyVp.w <= 0 || skyVp.h <= 0) return [];
    const half = STAR_HIT_PX / 2;
    const rows: Array<{ star: SkyViewStarDto; left: number; top: number }> = [];
    for (const s of data.stars) {
      if (!s.visible) continue;
      const base = azAltToNorm(s.azDeg, s.altDeg);
      const { nx, ny } = rotateSkyNorm(base.nx, base.ny, celestialRot);
      const { x, y } = normToLayoutSlice(nx, ny, skyVp.w, skyVp.h);
      rows.push({ star: s, left: x - half, top: y - half });
    }
    rows.sort((a, b) => b.star.mag - a.star.mag);
    return rows;
  }, [data, skyVp.w, skyVp.h, celestialRot]);

  const kstPrimary = formatKstFull(observeAtIso);
  const utcNote = formatUtcFootnote(observeAtIso);
  const useGlView = renderEngine === 'gl' && Platform.OS !== 'web';

  const win = Dimensions.get('window');
  const stageW = skyStage.w > 0 ? skyStage.w : win.width;
  const stageH = skyStage.h > 0 ? skyStage.h : win.height;
  const top3MaxWidth = Math.min(142, stageW * 0.42);
  const controlsMaxW = Math.min(188, Math.max(136, stageW - top3MaxWidth - 44));

  const top3Floating = (
    <View
      style={[
        styles.top3FloatWrap,
        {
          top: Math.max(insets.top, 6) + 4,
          right: 10,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.top3FloatCard,
          {
            borderColor: theme.borderSubtle,
            maxWidth: top3MaxWidth,
          },
        ]}
        accessibilityLabel="주간 Star-Index 상위 명소"
      >
        <Text style={[styles.top3FloatLabel, { color: theme.mutedForeground }]}>주간 TOP3</Text>
        {top5Loading ? (
          <Text style={{ color: theme.mutedForeground, fontSize: 10, marginTop: 6 }}>불러오는 중…</Text>
        ) : top5Error ? (
          <Text style={{ color: theme.destructive, fontSize: 9, marginTop: 6 }} numberOfLines={3}>
            {top5Error}
          </Text>
        ) : top5Items == null ? (
          <Text style={{ color: theme.mutedForeground, fontSize: 10, marginTop: 6 }}>준비 중</Text>
        ) : top5Items.length === 0 ? (
          <Text style={{ color: theme.mutedForeground, fontSize: 10, marginTop: 6 }}>데이터 없음</Text>
        ) : (
          top5Items.slice(0, 3).map((item) => {
            const selected = selectedSpotId === item.spotId;
            const displayName = spotNameWithoutRegionPrefix(item.spotName);
            const topSi = getStarIndexScoreDisplay(item.avgStarIndex);
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelectTop5Spot(item.spotId)}
                style={({ pressed }) => ({
                  marginTop: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 2,
                  opacity: pressed ? 0.88 : 1,
                  borderLeftWidth: 2,
                  borderLeftColor: selected ? theme.starGold : 'transparent',
                  paddingLeft: 6,
                })}
              >
                <View style={styles.top3RowHead}>
                  <Text
                    style={[
                      styles.top3Rank,
                      {
                        color:
                          item.rank === 1
                            ? theme.starGold
                            : item.rank === 2
                              ? theme.mutedForeground
                              : theme.mutedForeground,
                      },
                    ]}
                  >
                    {item.rank}
                  </Text>
                  <Text
                    style={[
                      styles.top3Score,
                      {
                        color: topSi.measurable ? theme.starGold : theme.destructive,
                        fontSize: topSi.measurable ? undefined : 11,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {topSi.label}
                  </Text>
                </View>
                <Text
                  style={[styles.top3Name, { color: theme.foreground }]}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );

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
          <Stop offset="46%" stopColor={skyBackdrop.mid} />
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
        <RadialGradient id="mwDustA" cx="32" cy="34" r="38" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#c8d0f8" stopOpacity="0.28" />
          <Stop offset="45%" stopColor="#7080b0" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#283050" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mwDustB" cx="70" cy="46" r="32" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#a8b0e0" stopOpacity="0.26" />
          <Stop offset="100%" stopColor="#202840" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* 하늘 배경·은하 — 태양 고도(관측 시각·위치)에 따라 낮/황혼/밤 */}
      <G transform={`rotate(${skyRotation}, 50, 50)`}>
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
        <Ellipse
          cx="34"
          cy="36"
          rx="27"
          ry="11"
          fill="url(#mwDustA)"
          opacity={skyBackdrop.milkyOpacity * 0.45}
        />
        <Ellipse
          cx="64"
          cy="46"
          rx="22"
          ry="8"
          fill="url(#mwDustB)"
          opacity={skyBackdrop.milkyOpacity * 0.37}
        />
      </G>
      {/* 별·태양·별선·행성 — 나침반 + 패닝 */}
      <G transform={`rotate(${celestialRot}, 50, 50)`}>
        {sunAltAzForSky ? (
          <SunGlyph
            nx={azAltToNorm(sunAltAzForSky.azDeg, sunAltAzForSky.altDeg).nx}
            ny={azAltToNorm(sunAltAzForSky.azDeg, sunAltAzForSky.altDeg).ny}
            altDeg={sunAltAzForSky.altDeg}
          />
        ) : null}
        {lineSegments.map((seg, i) => {
          const a = starsByHip.get(seg.fromHip);
          const b = starsByHip.get(seg.toHip);
          if (!a?.visible || !b?.visible) return null;
          const pa = azAltToNorm(a.azDeg, a.altDeg);
          const pb = azAltToNorm(b.azDeg, b.altDeg);
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
            const { nx, ny } = azAltToNorm(s.azDeg, s.altDeg);
            return (
              <CompactStarGlyph
                key={s.hip}
                nx={nx}
                ny={ny}
                mag={s.mag}
                opacityScale={skyBackdrop.starOpacity}
              />
            );
          })}
        {(data.bodies ?? [])
          .filter((b: SkyViewBodyDto) => b.visible)
          .map((b: SkyViewBodyDto) => {
            const { nx, ny } = azAltToNorm(b.azDeg, b.altDeg);
            return <CelestialBodyMarker key={b.id} nx={nx} ny={ny} body={b} />;
          })}
      </G>
      <G transform={`rotate(${skyRotation}, 50, 50)`}>
        <Path d={STELLARIUM_HILL_BASE} fill="#030308" opacity={skyBackdrop.hillOpacity} />
        <Path d={STELLARIUM_TREE_LINE} fill="#020205" opacity={skyBackdrop.hillOpacity} />
        {STELLARIUM_BOKEH.map((b, i) => (
          <Circle
            key={`bokeh-${i}`}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill="#ffe8c8"
            opacity={b.o * skyBackdrop.hillOpacity}
          />
        ))}
      </G>
      {data.constellationLabels.map((lb, idx) => {
        const base = azAltToNorm(lb.azDeg, lb.altDeg);
        const { nx, ny } = rotateSkyNorm(base.nx, base.ny, celestialRot);
        const label = CON_LABEL_KO[lb.con] ?? lb.con;
        const ly = Math.max(5, ny - 4);
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
          const base = azAltToNorm(lb.azDeg, lb.altDeg);
          const { nx, ny } = rotateSkyNorm(base.nx, base.ny, celestialRot);
          const ly = Math.max(5, ny - 4);
          const { x, y } = normToLayoutSlice(nx, ly, skyVp.w, skyVp.h);
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
              top: Math.max(insets.top, 6) + 4,
              left: 8,
              maxWidth: controlsMaxW,
            },
          ]}
          pointerEvents="auto"
        >
        <View style={[styles.controlsFloatInner, { borderColor: theme.borderSubtle }]}>
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
                  label="시야 원위치 (좌우 패닝 초기화)"
                  variant="outline"
                  size="sm"
                  disabled={Math.abs(viewAzPanDeg) < 0.25}
                  onPress={() => setViewAzPanDeg(0)}
                />
                {Math.abs(viewAzPanDeg) >= 0.25 ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 9,
                      marginTop: 6,
                      lineHeight: 13,
                    }}
                  >
                    가로로 드래그해 천구만 돌려 본 상태입니다. 버튼으로 처음 각도로 돌아갑니다.
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
        </View>
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
            위치를 잡으면 천구가 화면을 채웁니다. 명소는 오른쪽 TOP3에서 고를 수 있어요.
          </Text>
          {Platform.OS !== 'web' &&
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
            description="위치 권한을 허용하거나 지도·TOP3에서 명소를 고르세요"
          >
            <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
              GPS가 꺼져 있으면 기본 명소나 TOP3 좌표로 천구를 그립니다.
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
                  skyRotationDeg={skyRotation}
                  celestialPanDeg={viewAzPanDeg}
                  data={data}
                  lineSegments={lineSegments}
                  starsByHip={starsByHip}
                  starColorHex="#f0f4ff"
                  lineColorHex="#c4b8e8"
                  bodyPlanetHex="#f4e6d8"
                  bodyMoonHex="#fff6dc"
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

          {data ? controlsPanel : null}
        </View>
      )}
      {top3Floating}

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
    marginHorizontal: 3,
    marginVertical: 3,
    overflow: 'hidden',
    borderRadius: 10,
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
    backgroundColor: 'rgba(6, 8, 14, 0.55)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
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

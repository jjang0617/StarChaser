import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';
import { SkyObserverEmptyState } from './SkyObserverEmptyState';
import { SkyObserverControlsPanel } from './SkyObserverControlsPanel';
import {
  ApiRequestError,
  fetchConstellationLines,
  fetchStarIndexAtLocation,
  SessionExpiredError,
  type ConstellationLineSegmentDto,
  type SkyViewBodyDto,
  type SkyViewStarDto,
} from '../../lib/api-client';
import { useSkyHeading } from '../../hooks/use-sky-heading';
import { useSkyView } from '../../hooks/use-sky-view';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { starIndexLoadErrorMessage } from '../../lib/star-index-stale';
import { fetchSpotById } from '../../lib/spots-api';
import { getConstellationLore } from './constellation-lore';
import { SkyGlCanvas } from './SkyGlCanvas';
import { sunAltAzDeg } from '../../lib/sun-position';
import {
  computeViewBasis,
  GL_TAN_HALF_FOV,
  normToLayoutSlice,
  projectPerspectiveClip,
  projectToView,
} from './sky-projection';
import { skyBackdropFromSunAlt } from './sky-appearance';
import { namedStarLabelKo } from './named-star-labels';
import { layoutNamedStarLabels, type LabelAnchor } from './sky-label-layout';
import { formatStarDistanceLyAu } from '../../lib/star-distance-format';
import {
  CampSceneTile,
  CelestialBodyMarker,
  CompactStarGlyph,
  formatKstHm,
  formatKstShort,
  SunGlyph,
} from './scene/SkySceneGlyphs';
import {
  CAMP_HORIZON_BASE,
  CAMP_HORIZON_SLOPE,
  CAMP_TILE,
  clampNum,
  CON_LABEL_KO,
  normYaw,
  SKY_CONTROLS_EXPANDED_KEY,
  SKY_RENDER_STORAGE_KEY,
  STAR_HIT_PX,
  VIEW_DEFAULT_PITCH,
  VIEW_DEFAULT_YAW,
  type SkyOverlaySheet,
  type SkyTabScreenProps,
} from './sky-tab-constants';

export type { SkyTabScreenProps };

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
  const [lineSegments, setLineSegments] = useState<ConstellationLineSegmentDto[]>([]);
  const [alignHeading, setAlignHeading] = useState(false);
  const [motionAssist, setMotionAssist] = useState(false);
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

  const [locStarIndex, setLocStarIndex] = useState<StarIndexResponseDto | null>(null);
  const [locSiLoading, setLocSiLoading] = useState(false);
  const [locSiErr, setLocSiErr] = useState<string | null>(null);

  /** 앱 '위치 사용'이 꺼져 있으면 GPS·명소 폴백 모두 무시 — SKY는 빈 상태만 표시 */
  const obsLat = !locationFeaturesEnabled
    ? null
    : observerLat != null && Number.isFinite(observerLat)
      ? observerLat
      : spotFallback?.lat ?? null;
  const obsLng = !locationFeaturesEnabled
    ? null
    : observerLng != null && Number.isFinite(observerLng)
      ? observerLng
      : spotFallback?.lng ?? null;

  useEffect(() => {
    // 위치 사용 OFF — 폴백 좌표를 만들지 않아 빈 상태로 떨어지게 한다
    if (!locationFeaturesEnabled) {
      setSpotFallback(null);
      return;
    }
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
  }, [
    observerLat,
    observerLng,
    observerSpotId,
    locationFeaturesEnabled,
    onSessionInvalidated,
  ]);

  const {
    data,
    loading,
    err,
    load,
    viewYawDeg,
    viewPitchDeg,
    skyPanResponder,
    resetView,
  } = useSkyView({
    obsLat,
    obsLng,
    observeAtIso,
    onSessionInvalidated,
  });

  const { headingDeg, headingErr } = useSkyHeading({
    alignHeading,
    motionAssist,
    locationFeaturesEnabled,
  });

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
            setLocSiErr(starIndexLoadErrorMessage(e));
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

  const kstHmCompact = formatKstHm(observeAtIso);
  const kstShort = formatKstShort(observeAtIso);

  const win = Dimensions.get('window');
  const stageW = skyStage.w > 0 ? skyStage.w : win.width;
  const stageH = skyStage.h > 0 ? skyStage.h : win.height;
  /** 풀블리드 SKY는 상단 safe area 없음 → 상태바 아래 여백 */
  const skyOverlayTop = insets.top + spacing.md;
  const controlsMaxW = controlsExpanded
    ? Math.min(252, stageW - spacing.lg * 2)
    : Math.min(188, Math.max(128, stageW * 0.44));

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
    hasObserver && data && obsLat != null && obsLng != null ? (
      <View
        style={[StyleSheet.absoluteFillObject, styles.controlsTouchPassthrough]}
        pointerEvents="box-none"
      >
        <SkyObserverControlsPanel
          top={skyOverlayTop}
          maxWidth={controlsMaxW}
          expanded={controlsExpanded}
          onToggleExpanded={() => persistControlsExpanded(!controlsExpanded)}
          kstHmCompact={kstHmCompact}
          kstShort={kstShort}
          panelBottomInset={insets.bottom}
          obsLat={obsLat}
          obsLng={obsLng}
          skyUsesGps={skyUsesGps}
          usesSpotFallback={!skyUsesGps && spotFallback != null}
          placeName={locStarIndex?.name ?? null}
          locationFeaturesEnabled={locationFeaturesEnabled}
          locationPermissionStatus={locationPermissionStatus}
          locationDenied={locDenied}
          onRequestLocationPermission={onRequestLocationPermission}
          locSiLoading={locSiLoading}
          locSiErr={locSiErr}
          locSiDisplay={locSiDisplay}
          locStarIndex={locStarIndex}
          onShiftHours={onShiftHours}
          onObserveNow={onObserveNow}
          alignHeading={alignHeading}
          motionAssist={motionAssist}
          onToggleAlignHeading={() => setAlignHeading((v) => !v)}
          onToggleMotionAssist={() => setMotionAssist((v) => !v)}
          viewIsDefault={viewIsDefault}
          onResetView={resetView}
          renderEngine={renderEngine}
          onSelectRenderEngine={persistRenderEngine}
          onRefreshSky={() => void load()}
          skyLoading={loading}
          headingDeg={headingDeg}
          headingErr={headingErr}
          showDevRenderBadge={__DEV__}
        />
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
        <SkyObserverEmptyState
          locationFeaturesEnabled={locationFeaturesEnabled}
          locationPermissionStatus={locationPermissionStatus}
          onRequestLocationPermission={onRequestLocationPermission}
        />
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

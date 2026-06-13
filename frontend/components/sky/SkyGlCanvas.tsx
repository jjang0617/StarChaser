import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type {
  ConstellationLineSegmentDto,
  SkyViewBodyDto,
  SkyViewResponseDto,
  SkyViewStarDto,
} from '../../lib/api-client';
import { createSkyGlTextures, deleteSkyGlTextures } from './gl-textures';
import {
  dirFromAzAlt,
  GL_FOV_V_DEG,
  magToRadius,
  planetDiskRadius,
  projectPerspectiveClip,
  type ViewBasis,
} from './sky-projection';

type Rgb = [number, number, number];

function hexToRgb01(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return [0.9, 0.9, 0.92];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'shader compile';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('createProgram');
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) || 'link';
    gl.deleteProgram(p);
    throw new Error(log);
  }
  return p;
}

/** 시각등급 → 밝기·살짝 푸른 백색 */
function starRgbFromMag(mag: number): Rgb {
  const m = Math.max(-2, Math.min(7, mag));
  const bright = 1 / (1 + 0.45 * Math.max(0, m + 1.8));
  const b = Math.min(1, 0.78 + (2 - m) * 0.02);
  const g = Math.min(1, 0.9 + (2 - m) * 0.015);
  const r = Math.min(1, 0.88 + (2 - m) * 0.01);
  const k = 0.35 + 0.65 * bright;
  return [r * k, g * k, Math.min(1, b * 1.02) * k];
}

const VS_FULLSCREEN = `
attribute vec2 a_pos;
varying vec2 v_ndc;
void main() {
  v_ndc = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** 원근 카메라: 화면 픽셀 → 시선 광선(직선 투영) → 고도별 대기색·은하·지평선 */
const FS_SKY_DOME = `
precision mediump float;
varying vec2 v_ndc;
uniform vec3 u_fwd;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_sunDir;
uniform float u_sunAlt;
uniform float u_tanHalfFov;
uniform float u_aspect;
uniform sampler2D u_milky;
uniform sampler2D u_horizonRim;

void main() {
  // 풀스크린 NDC(-1..1) → 원근 광선. 화면을 사각형으로 가득 채움(둥근 테두리 없음)
  vec3 dir = normalize(
    u_fwd
    + v_ndc.x * u_tanHalfFov * u_aspect * u_right
    + v_ndc.y * u_tanHalfFov * u_up
  );
  float altDeg = degrees(asin(clamp(dir.z, -1.0, 1.0)));

  // 지평선 아래 = 땅
  if (altDeg < 0.0) {
    float t = clamp(-altDeg / 12.0, 0.0, 1.0);
    vec3 treetop = vec3(0.03, 0.06, 0.025);
    vec3 ground = vec3(0.012, 0.014, 0.018);
    gl_FragColor = vec4(mix(treetop, ground, t), 1.0);
    return;
  }

  float tZen = clamp(altDeg / 90.0, 0.0, 1.0);

  vec3 deep = vec3(0.018, 0.02, 0.045);
  vec3 mid = vec3(0.04, 0.042, 0.085);
  vec3 twi = vec3(0.12, 0.08, 0.18);
  vec3 horizWarm = vec3(0.55, 0.22, 0.12);
  vec3 horizGlow = vec3(0.95, 0.55, 0.28);

  vec3 skyCol = deep;
  float midMix = smoothstep(0.16, 0.48, tZen) * (1.0 - smoothstep(0.58, 0.92, tZen));
  skyCol = mix(skyCol, mid, midMix * 0.5);
  skyCol = mix(skyCol, twi, smoothstep(0.08, 0.35, 1.0 - tZen));

  // 황혼 세기: 태양이 지평선 부근일 때 최대, 깊은 밤(-18°↓)/낮(+12°↑)이면 0
  float tw = smoothstep(-18.0, -3.0, u_sunAlt) * (1.0 - smoothstep(4.0, 14.0, u_sunAlt));
  // 태양 방향 정렬: 해가 진 방위 쪽에 노을을 집중, 나머지 지평선엔 옅게만
  float aim = max(0.0, dot(dir, normalize(u_sunDir)));
  float glowAim = 0.10 + 0.90 * pow(aim, 2.5);

  float low = smoothstep(22.0, 0.0, altDeg);
  skyCol = mix(skyCol, horizWarm, low * 0.55 * tw * glowAim);
  float rim = smoothstep(12.0, 0.0, altDeg);
  skyCol += horizGlow * rim * 0.30 * tw * glowAim;

  float az = atan(dir.x, dir.y);
  float azn = az * 0.15915494309189535;
  float altn = clamp(altDeg / 90.0, 0.0, 1.0);
  vec2 muv = vec2(fract(azn), 1.0 - altn * 0.94 + 0.03);
  vec4 mwTex = texture2D(u_milky, muv);
  float mwMask =
    smoothstep(5.0, 34.0, altDeg) *
    (1.0 - smoothstep(76.0, 92.0, altDeg)) *
    (1.0 - smoothstep(48.0, 82.0, altDeg));
  skyCol += mwTex.rgb * mwTex.a * 0.38 * mwMask;

  vec4 rimTex = texture2D(u_horizonRim, vec2(0.5, 1.0 - altn));
  float rimMask = smoothstep(20.0, 0.0, altDeg);
  skyCol += rimTex.rgb * rimTex.a * rimMask * 0.42 * tw * glowAim;

  gl_FragColor = vec4(clamp(skyCol, 0.0, 1.0), 1.0);
}
`;

const VS_POINTS = `
attribute vec2 a_pos;
attribute vec3 a_col;
attribute float a_size;
varying vec3 v_col;
void main() {
  v_col = a_col;
  gl_Position = vec4(a_pos, 0.0, 1.0);
  gl_PointSize = a_size;
}
`;

/** 텍스처 기반 스프라이트 + 색 조명 */
const FS_STAR_SPRITE = `
precision mediump float;
varying vec3 v_col;
uniform sampler2D u_starSprite;
void main() {
  vec4 tex = texture2D(u_starSprite, gl_PointCoord);
  vec3 rgb = v_col * (0.55 + 0.5 * tex.rgb);
  float a = tex.a;
  gl_FragColor = vec4(rgb * (0.72 + 0.28 * a), a);
}
`;

const VS_LINES = `
attribute vec2 a_pos;
attribute vec3 a_col;
varying vec3 v_col;
void main() {
  v_col = a_col;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FS_LINES = `
precision mediump float;
varying vec3 v_col;
void main() {
  gl_FragColor = vec4(v_col, 0.38);
}
`;

export interface SkyGlCanvasProps {
  /** 1인칭 자유 시점 카메라 기저(orthonormal) */
  viewBasis: ViewBasis;
  data: SkyViewResponseDto;
  lineSegments: ConstellationLineSegmentDto[];
  starsByHip: Map<number, SkyViewStarDto>;
  starColorHex: string;
  lineColorHex: string;
  bodyPlanetHex: string;
  bodyMoonHex: string;
  /** 태양 지평좌표(방위·고도) — 황혼/노을 방향성 연출용. null이면 깊은 밤 처리 */
  sunAltAz?: { azDeg: number; altDeg: number } | null;
  squareSize?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  hideCaption?: boolean;
}

/**
 * 스타렐리움에 가까운 야간 천구: 대기 셰이더 + 은하수 밴드 + 지평선/땅 + 소프트 별 스프라이트.
 */
export function SkyGlCanvas({
  viewBasis,
  data,
  lineSegments,
  starsByHip,
  starColorHex,
  lineColorHex,
  bodyPlanetHex,
  bodyMoonHex,
  sunAltAz,
  squareSize,
  layoutWidth,
  layoutHeight,
  hideCaption = false,
}: SkyGlCanvasProps) {
  const [gl, setGl] = useState<ExpoWebGLRenderingContext | null>(null);
  const [glErr, setGlErr] = useState<string | null>(null);
  const sunAltDeg = sunAltAz?.altDeg ?? -90;
  const sunDir: Rgb = sunAltAz
    ? (dirFromAzAlt(sunAltAz.azDeg, sunAltAz.altDeg) as Rgb)
    : [0, 0, -1];
  const propsRef = useRef({
    viewBasis,
    data,
    lineSegments,
    starsByHip,
    starRgb: hexToRgb01(starColorHex),
    lineRgb: hexToRgb01(lineColorHex),
    planetRgb: hexToRgb01(bodyPlanetHex),
    moonRgb: hexToRgb01(bodyMoonHex),
    sunDir,
    sunAltDeg,
  });

  propsRef.current = {
    viewBasis,
    data,
    lineSegments,
    starsByHip,
    starRgb: hexToRgb01(starColorHex),
    lineRgb: hexToRgb01(lineColorHex),
    planetRgb: hexToRgb01(bodyPlanetHex),
    moonRgb: hexToRgb01(bodyMoonHex),
    sunDir,
    sunAltDeg,
  };

  const onContextCreate = useCallback((g: ExpoWebGLRenderingContext) => {
    try {
      setGlErr(null);
      setGl(g);
    } catch (e) {
      setGlErr(e instanceof Error ? e.message : 'GL 초기화 실패');
    }
  }, []);

  useEffect(() => {
    if (!gl || Platform.OS === 'web') return;
    const glCtx = gl as unknown as WebGLRenderingContext;

    let raf = 0;
    let skyProg: WebGLProgram;
    let pointProg: WebGLProgram;
    let lineProg: WebGLProgram;
    try {
      skyProg = createProgram(glCtx, VS_FULLSCREEN, FS_SKY_DOME);
      pointProg = createProgram(glCtx, VS_POINTS, FS_STAR_SPRITE);
      lineProg = createProgram(glCtx, VS_LINES, FS_LINES);
    } catch (e) {
      setGlErr(e instanceof Error ? e.message : '셰이더 오류');
      return;
    }

    const skyPosLoc = glCtx.getAttribLocation(skyProg, 'a_pos');
    const uFwd = glCtx.getUniformLocation(skyProg, 'u_fwd');
    const uRight = glCtx.getUniformLocation(skyProg, 'u_right');
    const uUp = glCtx.getUniformLocation(skyProg, 'u_up');
    const uSunDir = glCtx.getUniformLocation(skyProg, 'u_sunDir');
    const uSunAlt = glCtx.getUniformLocation(skyProg, 'u_sunAlt');
    const uTanHalfFov = glCtx.getUniformLocation(skyProg, 'u_tanHalfFov');
    const uAspect = glCtx.getUniformLocation(skyProg, 'u_aspect');
    const uMilky = glCtx.getUniformLocation(skyProg, 'u_milky');
    const uHorizonRim = glCtx.getUniformLocation(skyProg, 'u_horizonRim');

    const pointPosLoc = glCtx.getAttribLocation(pointProg, 'a_pos');
    const pointColLoc = glCtx.getAttribLocation(pointProg, 'a_col');
    const pointSizeLoc = glCtx.getAttribLocation(pointProg, 'a_size');
    const linePosLoc = glCtx.getAttribLocation(lineProg, 'a_pos');
    const lineColLoc = glCtx.getAttribLocation(lineProg, 'a_col');
    const uStarSprite = glCtx.getUniformLocation(pointProg, 'u_starSprite');

    let textures: ReturnType<typeof createSkyGlTextures>;
    try {
      textures = createSkyGlTextures(glCtx);
    } catch (e) {
      setGlErr(e instanceof Error ? e.message : '텍스처 생성 실패');
      glCtx.deleteProgram(skyProg);
      glCtx.deleteProgram(pointProg);
      glCtx.deleteProgram(lineProg);
      return;
    }

    const quadBuf = glCtx.createBuffer();
    const pointBuf = glCtx.createBuffer();
    const lineBuf = glCtx.createBuffer();
    if (!quadBuf || !pointBuf || !lineBuf) {
      deleteSkyGlTextures(glCtx, textures);
      glCtx.deleteProgram(skyProg);
      glCtx.deleteProgram(pointProg);
      glCtx.deleteProgram(lineProg);
      setGlErr('버퍼 생성 실패');
      return;
    }

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, quadBuf);
    glCtx.bufferData(glCtx.ARRAY_BUFFER, quadVerts, glCtx.STATIC_DRAW);

    const maxPoints = 4000;
    const maxLineVerts = 4096;
    const pointInterleaved = new Float32Array(maxPoints * 6);
    const lineInterleaved = new Float32Array(maxLineVerts * 5);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = propsRef.current;
      const w = glCtx.drawingBufferWidth;
      const h = glCtx.drawingBufferHeight;
      glCtx.viewport(0, 0, w, h);
      glCtx.disable(glCtx.BLEND);

      const aspect = h > 0 ? w / h : 1;
      const tanHalfFov = Math.tan((GL_FOV_V_DEG * Math.PI) / 360);

      const basis = p.viewBasis;
      glCtx.useProgram(skyProg);
      glCtx.uniform3f(uFwd, basis.fwd[0], basis.fwd[1], basis.fwd[2]);
      glCtx.uniform3f(uRight, basis.right[0], basis.right[1], basis.right[2]);
      glCtx.uniform3f(uUp, basis.up[0], basis.up[1], basis.up[2]);
      glCtx.uniform3f(uSunDir, p.sunDir[0], p.sunDir[1], p.sunDir[2]);
      glCtx.uniform1f(uSunAlt, p.sunAltDeg);
      glCtx.uniform1f(uTanHalfFov, tanHalfFov);
      glCtx.uniform1f(uAspect, aspect);
      glCtx.activeTexture(glCtx.TEXTURE0);
      glCtx.bindTexture(glCtx.TEXTURE_2D, textures.milky);
      glCtx.uniform1i(uMilky, 0);
      glCtx.activeTexture(glCtx.TEXTURE1);
      glCtx.bindTexture(glCtx.TEXTURE_2D, textures.horizonRim);
      glCtx.uniform1i(uHorizonRim, 1);
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, quadBuf);
      glCtx.enableVertexAttribArray(skyPosLoc);
      glCtx.vertexAttribPointer(skyPosLoc, 2, glCtx.FLOAT, false, 0, 0);
      glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);
      glCtx.disableVertexAttribArray(skyPosLoc);

      glCtx.enable(glCtx.BLEND);
      glCtx.blendFunc(glCtx.SRC_ALPHA, glCtx.ONE_MINUS_SRC_ALPHA);

      let li = 0;
      const lineRgbLine: Rgb = [0.5, 0.54, 0.68];
      for (let i = 0; i < p.lineSegments.length; i += 1) {
        const seg = p.lineSegments[i];
        const a = p.starsByHip.get(seg.fromHip);
        const b = p.starsByHip.get(seg.toHip);
        if (!a?.visible || !b?.visible) continue;
        const pa = projectPerspectiveClip(a.azDeg, a.altDeg, basis, tanHalfFov, aspect);
        const pb = projectPerspectiveClip(b.azDeg, b.altDeg, basis, tanHalfFov, aspect);
        if (!pa.visible || !pb.visible) continue;
        const o = li * 10;
        lineInterleaved[o] = pa.cx;
        lineInterleaved[o + 1] = pa.cy;
        lineInterleaved[o + 2] = lineRgbLine[0];
        lineInterleaved[o + 3] = lineRgbLine[1];
        lineInterleaved[o + 4] = lineRgbLine[2];
        lineInterleaved[o + 5] = pb.cx;
        lineInterleaved[o + 6] = pb.cy;
        lineInterleaved[o + 7] = lineRgbLine[0];
        lineInterleaved[o + 8] = lineRgbLine[1];
        lineInterleaved[o + 9] = lineRgbLine[2];
        li += 2;
        if (li >= maxLineVerts - 1) break;
      }

      if (li > 0) {
        glCtx.useProgram(lineProg);
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, lineBuf);
        glCtx.bufferData(
          glCtx.ARRAY_BUFFER,
          lineInterleaved.subarray(0, li * 5),
          glCtx.DYNAMIC_DRAW,
        );
        const lstride = 5 * 4;
        glCtx.enableVertexAttribArray(linePosLoc);
        glCtx.vertexAttribPointer(linePosLoc, 2, glCtx.FLOAT, false, lstride, 0);
        glCtx.enableVertexAttribArray(lineColLoc);
        glCtx.vertexAttribPointer(lineColLoc, 3, glCtx.FLOAT, false, lstride, 8);
        glCtx.drawArrays(glCtx.LINES, 0, li);
        glCtx.disableVertexAttribArray(linePosLoc);
        glCtx.disableVertexAttribArray(lineColLoc);
      }

      let pi = 0;
      const pushPoint = (cx: number, cy: number, rgb: Rgb, sizePx: number) => {
        const o = pi * 6;
        pointInterleaved[o] = cx;
        pointInterleaved[o + 1] = cy;
        pointInterleaved[o + 2] = rgb[0];
        pointInterleaved[o + 3] = rgb[1];
        pointInterleaved[o + 4] = rgb[2];
        pointInterleaved[o + 5] = sizePx;
        pi += 1;
      };

      const minDim = Math.min(w, h);
      const tSec = Date.now() / 1000;
      let starIdx = 0;
      for (const s of p.data.stars) {
        starIdx += 1;
        if (!s.visible) continue;
        const r = projectPerspectiveClip(s.azDeg, s.altDeg, basis, tanHalfFov, aspect);
        if (!r.visible) continue;
        const rgb = starRgbFromMag(s.mag);
        const pr = magToRadius(s.mag) * (minDim / 100) * 2.85;
        const sz = Math.max(2.2, Math.min(18, pr));
        // 대기 산란에 의한 반짝임(scintillation): 별마다 위상이 달라 0.6~1.0로 깜빡
        const twk =
          0.8 +
          0.2 *
            Math.sin(tSec * 2.4 + starIdx * 1.7) *
            Math.cos(tSec * 1.6 + starIdx * 0.9);
        const tRgb: Rgb = [rgb[0] * twk, rgb[1] * twk, rgb[2] * twk];
        // 블룸/할레이션: 밝은 별 아래에 크고 옅은 헤일로를 가산 합성
        if (s.mag < 1.7) {
          pushPoint(
            r.cx,
            r.cy,
            [tRgb[0] * 0.42, tRgb[1] * 0.42, tRgb[2] * 0.46],
            Math.min(34, sz * 2.6),
          );
        }
        pushPoint(r.cx, r.cy, tRgb, sz * (0.94 + 0.06 * twk));
        if (pi >= maxPoints - 6) break;
      }

      for (const b of p.data.bodies ?? []) {
        if (!(b as SkyViewBodyDto).visible) continue;
        const body = b as SkyViewBodyDto;
        const r = projectPerspectiveClip(body.azDeg, body.altDeg, basis, tanHalfFov, aspect);
        if (!r.visible) continue;
        const rgb: Rgb =
          body.id === 'moon'
            ? (p.moonRgb as Rgb)
            : body.id === 'venus'
              ? [0.98, 0.96, 0.92]
              : (p.planetRgb as Rgb);
        const sz =
          body.id === 'moon'
            ? Math.max(16, minDim * 0.045)
            : Math.max(10, planetDiskRadius(body.magnitude) * (minDim / 100) * 2.8);
        const disk = Math.min(36, sz);
        // 행성·달의 부드러운 광채(블룸)
        pushPoint(
          r.cx,
          r.cy,
          [rgb[0] * 0.34, rgb[1] * 0.34, rgb[2] * 0.36],
          Math.min(64, disk * 2.4),
        );
        pushPoint(r.cx, r.cy, rgb, disk);
        if (pi >= maxPoints - 2) break;
      }

      if (pi > 0) {
        glCtx.useProgram(pointProg);
        glCtx.activeTexture(glCtx.TEXTURE0);
        glCtx.bindTexture(glCtx.TEXTURE_2D, textures.starSprite);
        glCtx.uniform1i(uStarSprite, 0);
        glCtx.blendFunc(glCtx.SRC_ALPHA, glCtx.ONE);
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, pointBuf);
        glCtx.bufferData(
          glCtx.ARRAY_BUFFER,
          pointInterleaved.subarray(0, pi * 6),
          glCtx.DYNAMIC_DRAW,
        );
        const stride = 6 * 4;
        glCtx.enableVertexAttribArray(pointPosLoc);
        glCtx.vertexAttribPointer(pointPosLoc, 2, glCtx.FLOAT, false, stride, 0);
        glCtx.enableVertexAttribArray(pointColLoc);
        glCtx.vertexAttribPointer(pointColLoc, 3, glCtx.FLOAT, false, stride, 8);
        glCtx.enableVertexAttribArray(pointSizeLoc);
        glCtx.vertexAttribPointer(pointSizeLoc, 1, glCtx.FLOAT, false, stride, 20);
        glCtx.drawArrays(glCtx.POINTS, 0, pi);
        glCtx.disableVertexAttribArray(pointPosLoc);
        glCtx.disableVertexAttribArray(pointColLoc);
        glCtx.disableVertexAttribArray(pointSizeLoc);
        glCtx.blendFunc(glCtx.SRC_ALPHA, glCtx.ONE_MINUS_SRC_ALPHA);
      }

      glCtx.flush();
      const exgl = gl as ExpoWebGLRenderingContext & { endFrameEXP?: () => void };
      exgl.endFrameEXP?.();
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      deleteSkyGlTextures(glCtx, textures);
      glCtx.deleteProgram(skyProg);
      glCtx.deleteProgram(pointProg);
      glCtx.deleteProgram(lineProg);
      glCtx.deleteBuffer(quadBuf);
      glCtx.deleteBuffer(pointBuf);
      glCtx.deleteBuffer(lineBuf);
    };
  }, [gl]);

  const wrapStyle: ViewStyle = (() => {
    if (
      layoutWidth != null &&
      layoutHeight != null &&
      layoutWidth > 0 &&
      layoutHeight > 0
    ) {
      const r = Math.min(18, layoutWidth * 0.04, layoutHeight * 0.06);
      return {
        width: layoutWidth,
        height: layoutHeight,
        borderRadius: r,
        overflow: 'hidden',
      };
    }
    if (squareSize != null && squareSize > 0) {
      return {
        width: squareSize,
        height: squareSize,
        borderRadius: squareSize / 2,
        overflow: 'hidden',
      };
    }
    return styles.wrap;
  })();

  if (Platform.OS === 'web') {
    return (
      <View style={[wrapStyle, styles.fallback]}>
        <Text style={styles.fallbackText}>OpenGL 뷰는 네이티브(iOS/Android)에서만 지원됩니다.</Text>
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      {glErr ? <Text style={styles.err}>{glErr}</Text> : null}
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
      {!hideCaption ? (
        <Text style={styles.caption}>GPU · 텍스처 은하/지평선/별 스프라이트</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 340, borderRadius: 12, overflow: 'hidden' },
  gl: { flex: 1 },
  caption: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
  },
  err: { color: '#f87171', fontSize: 12, padding: 8 },
  fallback: {
    backgroundColor: '#0a0e18',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
});

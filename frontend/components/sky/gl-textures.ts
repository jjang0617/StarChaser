/**
 * WebGL1용 프로시저럴 RGBA 텍스처 (외부 PNG 없이 번들 크기·호환성 유지).
 * 은하수 밴드 노이즈 + 별 포인 스프라이트.
 */

function buildMilkyWayRgba(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const u = i / (size - 1);
      const v = j / (size - 1);
      const diag = (u + v - 0.72) * 2.8;
      const band = Math.exp(-diag * diag) * 210;
      const n =
        Math.sin(u * 89.2 + v * 47.3) * 0.5 +
        Math.sin(u * 31.1 - v * 67.4) * 0.32 +
        Math.sin((u - v * 1.3) * 55.7) * 0.22;
      const dust = (n * 0.5 + 0.5) * 52;
      const fil = Math.sin(u * 6.28318 * 3 + v * 4) * 15;
      const total = Math.min(255, Math.max(0, band + dust + fil));
      const idx = (j * size + i) * 4;
      data[idx] = Math.min(255, 95 + total * 0.28);
      data[idx + 1] = Math.min(255, 102 + total * 0.3);
      data[idx + 2] = Math.min(255, 148 + total * 0.34);
      data[idx + 3] = Math.min(255, total * 1.05);
    }
  }
  return data;
}

function buildStarSpriteRgba(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const inv = 2 / size;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const dx = (i - cx) * inv;
      const dy = (j - cy) * inv;
      const d = Math.sqrt(dx * dx + dy * dy);
      const core = Math.max(0, 1 - d / 0.32);
      const glow = Math.exp(-d * d * 4.2);
      const r = Math.min(255, core * 255 + glow * 200);
      const a = Math.min(255, core * 255 + glow * 140);
      const idx = (j * size + i) * 4;
      data[idx] = r;
      data[idx + 1] = Math.min(255, r * 0.98);
      data[idx + 2] = Math.min(255, r * 1.04);
      data[idx + 3] = a;
    }
  }
  return data;
}

/** 지평선 따뜻한 림 (세로 1D에 가깝게) — 대기 셰이더 블렌드용 */
function buildHorizonRimRgba(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j += 1) {
    const t = j / (h - 1);
    const warm = Math.pow(1 - t, 2.2);
    const r = Math.min(255, 40 + warm * 215);
    const g = Math.min(255, 25 + warm * 120);
    const b = Math.min(255, 15 + warm * 55);
    const a = Math.min(255, warm * 220);
    for (let i = 0; i < w; i += 1) {
      const idx = (j * w + i) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return data;
}

export function uploadTextureRgba(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  pixels: Uint8Array,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('createTexture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return tex;
}

const MILKY_SIZE = 256;
const SPRITE_SIZE = 64;
const RIM_W = 4;
const RIM_H = 128;

export function createSkyGlTextures(gl: WebGLRenderingContext): {
  milky: WebGLTexture;
  starSprite: WebGLTexture;
  horizonRim: WebGLTexture;
} {
  return {
    milky: uploadTextureRgba(gl, MILKY_SIZE, MILKY_SIZE, buildMilkyWayRgba(MILKY_SIZE)),
    starSprite: uploadTextureRgba(gl, SPRITE_SIZE, SPRITE_SIZE, buildStarSpriteRgba(SPRITE_SIZE)),
    horizonRim: uploadTextureRgba(gl, RIM_W, RIM_H, buildHorizonRimRgba(RIM_W, RIM_H)),
  };
}

export function deleteSkyGlTextures(
  gl: WebGLRenderingContext,
  t: { milky: WebGLTexture; starSprite: WebGLTexture; horizonRim: WebGLTexture },
): void {
  gl.deleteTexture(t.milky);
  gl.deleteTexture(t.starSprite);
  gl.deleteTexture(t.horizonRim);
}

// DV85 EMBER COUNTDOWN · glyph atlas for the shaders (built once per page, never per tick).
// Ten cells 0–9 of Abril Fatface. Channels: R = sharp coverage (reflection), G = small blur (bevel normal),
// A = medium blur (thick core runs hotter), B = wide blur (halo, flames, room light).
// The visible glyph EDGE never comes from here: it is an SVG <text> clip in the DOM (sharp at any DSF).

export const AF = 192;                       // atlas font px
export const PAD = 32;                       // blur room around each glyph
export const CELL_W = Math.ceil(0.72 * AF) + 2 * PAD;
export const ASC = Math.ceil(0.74 * AF);      // cap height is 0.711 em
export const BASE_ROW = PAD + ASC;            // baseline row inside a cell
export const CELL_H = BASE_ROW + Math.ceil(0.03 * AF) + PAD;
export const CAP = 0.711;                    // cap height / font size (measured)

function boxBlur(src, w, h, r, passes) {
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {                       // horizontal
      const o = y * w; let s = 0;
      for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[o + x] = s * inv;
        s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {                       // vertical
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s * inv;
        s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

export function buildAtlas(family = 'Abril Fatface') {
  const W = CELL_W * 10, H = CELL_H;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `400 ${AF}px '${family}'`;
  for (let d = 0; d < 10; d++) g.fillText(String(d), d * CELL_W + CELL_W / 2, BASE_ROW);
  const img = g.getImageData(0, 0, W, H).data;
  const R = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) R[i] = img[i * 4] / 255;
  const G = boxBlur(R, W, H, 2, 2), A = boxBlur(R, W, H, 5, 3), B = boxBlur(R, W, H, 9, 3);
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    out[i * 4] = R[i] * 255; out[i * 4 + 1] = Math.min(255, G[i] * 255);
    out[i * 4 + 2] = Math.min(255, B[i] * 255 * 1.6); out[i * 4 + 3] = Math.min(255, A[i] * 255);
  }
  return { data: out, w: W, h: H };
}

// a tileable soot / grain texture (value-noise fbm on a torus), 256², single channel
export function buildSoot(N = 256) {
  const lat = (n, seed) => { const a = new Float32Array(n * n); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
  const out = new Float32Array(N * N);
  let amp = 0.5, tot = 0;
  for (let o = 0, n = 8; o < 5; o++, n *= 2, amp *= 0.55) {
    const L = lat(n, 1234 + o * 77), k = N / n;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / k, fy = y / k, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = L[(iy % n) * n + ix % n], b = L[(iy % n) * n + (ix + 1) % n], c = L[((iy + 1) % n) * n + ix % n], d = L[((iy + 1) % n) * n + (ix + 1) % n];
      out[y * N + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
    }
    tot += amp;
  }
  const u8 = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) u8[i] = Math.max(0, Math.min(255, (out[i] / tot - 0.5) * 1.8 * 255 + 128));
  return { data: u8, w: N, h: N };
}

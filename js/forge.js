// DV85 EMBER COUNTDOWN · renderer. Two WebGL2 canvases:
//   fx    — the whole hero, behind the DOM, at reduced resolution (soft light, flames, floor, embers)
//   metal — only over the digit strip, full resolution, clipped by the DOM/SVG <text> so glyph edges stay vector-sharp.
import { makeGL } from './gl.js';
import { FX_FS, METAL_FS, EMBER_VS, EMBER_FS, BLIT_FS } from './shaders.js';
import { CELL_W, CELL_H, AF, BASE_ROW } from './atlas.js';

const SCENE_SCALE = 0.5;   // the soft scene renders at half the fx canvas resolution
const N_SPARK = 440, N_EMBER = 260, N_BOKEH = 26, N_SPLASH = 26;

export class Forge {
  constructor(fxCanvas, metalCanvas) { this.fxCanvas = fxCanvas; this.metalCanvas = metalCanvas; this.draws = { fx: 0, metal: 0 }; }

  init(atlas, soot) {
    this.atlas = atlas; this.soot = soot;
    // fx: soft content → modest resolution; metal: full resolution but a small strip
    this.fx = makeGL(this.fxCanvas, { alpha: false, dprMax: 1.25, maxPixels: 1.9e6 });
    // the glyph EDGE is the vector clip, so the surface shading inside it can run below device resolution
    this.mt = makeGL(this.metalCanvas, { alpha: true, dprMax: 1.5, maxPixels: 1.2e6 });
    if (!this.fx || !this.mt) return false;
    try { this.setup(); } catch (e) { console.warn('forge setup', e); return false; }
    return true;
  }

  setup() {
    const A = this.atlas, s = this.soot;
    { // fx context
      const X = this.fx, gl = X.gl;
      this.pFx = X.program(FX_FS);
      this.pEm = X.program(EMBER_FS, EMBER_VS);
      this.pBlit = X.program(BLIT_FS);
      this.scene = { tex: gl.createTexture(), fb: gl.createFramebuffer(), w: 0, h: 0 };
      this.fxAtlas = X.texture(A.data, { w: A.w, h: A.h });
      this.fxSoot = X.texture(s.data, { w: s.w, h: s.h, format: 'R', repeat: true, mip: true });
      const n = N_SPARK + N_EMBER + N_BOKEH + 8 * N_SPLASH, seeds = new Float32Array(n * 4);
      let r = 0.5; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
      this.seedBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      this.nInst = n;
      this.aSeed = gl.getAttribLocation(this.pEm.pr, 'aSeed');
    }
    { // metal context
      const M = this.mt;
      this.pMt = M.program(METAL_FS);
      this.mtAtlas = M.texture(A.data, { w: A.w, h: A.h });
    }
  }

  resize() {
    this.fx.resize(); this.mt.resize();
    const gl = this.fx.gl, T = this.scene;
    const w = Math.max(1, Math.ceil(this.fxCanvas.width * SCENE_SCALE)), h = Math.max(1, Math.ceil(this.fxCanvas.height * SCENE_SCALE));
    if (T.w === w && T.h === h) return;
    T.w = w; T.h = h;
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // common uniforms: slots, colons, geometry, effects
  common(P, f) {
    P.v4('uSlot', f.slot).v4('uAux', f.aux).v4('uColon', f.colon)
      .f('uGeo', f.F, f.base, f.span0, f.span1).f('uFx', f.fin, f.pulse, f.cold, f.flare).f('uTime', f.t);
    P.f('uAtl', CELL_W, CELL_H, AF, BASE_ROW).f('uAtlSize', this.atlas.w, this.atlas.h).i('uAtlas', 0);
  }

  render(f, { metal = true } = {}) {
    if (this.fx.lost || this.mt.lost) return;
    { const X = this.fx, gl = X.gl;
      const T = this.scene;
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, T.w, T.h);
      gl.disable(gl.BLEND);
      X.bind(0, this.fxAtlas); X.bind(1, this.fxSoot);
      const P = this.pFx.use().tri();
      this.common(P, f);
      P.f('uRes', T.w, T.h).f('uS', T.w / Math.max(1, X.w)).f('uPage', X.w, X.h).i('uSoot', 1).draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      X.bind(2, T.tex);
      this.pBlit.use().tri().i('uScene', 2).f('uRes', this.fxCanvas.width, this.fxCanvas.height).f('uTime', f.t).draw();
      // embers (additive, alpha untouched)
      const E = this.pEm.use();
      this.common(E, f);
      E.f('uPage', X.w, X.h).f('uCount', N_SPARK, N_EMBER, N_BOKEH, N_SPLASH)
        .fv('uChange', f.change).fv('uSplash', f.splash).f('uEndT', f.endT).f('uPtr', f.ptr[0], f.ptr[1], f.ptr[2]);
      gl.disableVertexAttribArray(0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuf);
      gl.enableVertexAttribArray(this.aSeed); gl.vertexAttribPointer(this.aSeed, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(this.aSeed, 1);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.nInst);
      gl.vertexAttribDivisor(this.aSeed, 0); gl.disableVertexAttribArray(this.aSeed);
      gl.disable(gl.BLEND);
      this.draws.fx++;
    }
    if (metal) { const M = this.mt, gl = M.gl;
      gl.viewport(0, 0, this.metalCanvas.width, this.metalCanvas.height);
      M.bind(0, this.mtAtlas);
      const P = this.pMt.use().tri();
      this.common(P, f);
      P.f('uRes', this.metalCanvas.width, this.metalCanvas.height).f('uS', M.dpr).f('uOff', f.off[0], f.off[1])
        .fv('uOldHeat', f.oldHeat).f('uAmb', f.amb[0], f.amb[1], f.amb[2]).draw();
      this.draws.metal++;
    }
  }
}

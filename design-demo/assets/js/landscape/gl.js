// gl.js — WebGL2 renderer for the landscape. Owns GL resources only; index.js decides when to draw.
//
//   A *view* is one painting: a window onto the world (the page's strip, its closing) or the full viewport (the
//   desktop horizon). Each view has its own ridge texture and its own scene framebuffer.
//   view(id, w, h)     make sure view `id` has a w x h scene buffer (buffer px); dropView(id) frees it
//   ridges(id, d, n)   upload view `id`'s ridge rows (n columns)
//   figure(id, img)    upload a figure layer ({ width, height, data: premultiplied RGBA bytes, top row first }) as a
//                      mipmapped texture (the mip levels give the bleed halo); figure(id, null) frees it
//   scene(id, U)       expensive painting of view `id` -> its framebuffer. A frame in motion (U.draft) is painted into
//                      a corner of the framebuffer at U.draftScale; present() stretches it back.
//   present(U)         cheap pass to the screen: the windows at their live boxes, the horizon band, mist, grain
//   busy()             is the GPU still painting the last presented frame? (a fence; index.js then skips a frame
//                      instead of queueing another behind it)
//   settle()           wait (blocking) until the GPU has finished everything drawn so far. Only for a page that is
//                      still hidden under the page wash: its first frame (shader compiles) lands there, not mid-reveal.
//
// Survives context loss: resources are rebuilt on 'webglcontextrestored' (views and figures are re-made by
// index.js, which repaints everything). destroy() frees them but keeps the context alive, so a remount on the same
// canvas (React Strict Mode) works.

import { VERT, NOISE, NOISE_SIZE, SCENE, PRESENT } from './shaders.js';
import { ROWS } from './ridges.js';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|warp/i;
const NONE4 = new Float32Array([2, 2, -1, -1]);
const ZERO4 = new Float32Array(4);

function detectRenderer(gl) {
  // gl.RENDERER first; browsers that mask it ("WebKit WebGL") still expose the debug extension.
  let name = '';
  try { name = String(gl.getParameter(gl.RENDERER) || ''); } catch { /* ignore */ }
  if (!name || /^(webkit|mozilla)\b|^webgl/i.test(name)) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || name);
    } catch { /* ignore */ }
  }
  return name;
}

/**
 * @returns {null | renderer}  null when WebGL2 is unavailable (the canvas is untouched).
 * Throws (err.tainted = true) if a context was created but could not be set up: the canvas can
 * then no longer give a 2D context, and the caller paints the fallback on a fresh canvas.
 */
export function createGL(canvas, hooks) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power',
    });
  } catch { gl = null; }
  if (!gl) return null;
  if (gl.isContextLost()) {
    const err = new Error('landscape: context lost at init');
    err.tainted = true;
    throw err;
  }

  const rendererName = detectRenderer(gl);
  const software = SOFTWARE.test(rendererName);
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  let R = null;           // live GL resources
  let W = 0, H = 0;       // drawing-buffer size
  const views = new Map();    // id -> { fb, tex, w, h, sw, sh, ridges, ridgeW, last }
  const figs = new Map();     // id -> texture
  let fence = null;       // set after a present: has the GPU finished that frame? (see busy())
  let fenceAt = 0;
  const px1 = new Uint8Array(4);   // settle()'s readback

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`landscape: shader compile failed\n${log}`);
    }
    return s;
  }
  function program(frag) {
    const p = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`landscape: link failed\n${gl.getProgramInfoLog(p)}`);
    }
    const locs = new Map();
    return {
      p,
      u(name) {
        if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name));
        return locs.get(name);
      },
    };
  }
  function tex(w, h, internal, format, type, wrap, data = null) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  function build() {
    const r = {};
    r.vao = gl.createVertexArray();
    gl.bindVertexArray(r.vao);
    r.noiseP = program(NOISE);
    r.sceneP = program(SCENE);
    r.presentP = program(PRESENT);
    // paper + mist noise, painted once
    r.noise = tex(NOISE_SIZE, NOISE_SIZE, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.REPEAT);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.noise, 0);
    gl.viewport(0, 0, NOISE_SIZE, NOISE_SIZE);
    gl.useProgram(r.noiseP.p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    // mipmaps: paper grain finer than a buffer pixel averages out instead of aliasing into speckle
    gl.bindTexture(gl.TEXTURE_2D, r.noise);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.deleteProgram(r.noiseP.p);
    r.noiseP = null;
    // a 1x1 transparent texture for unused samplers
    r.blank = tex(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.CLAMP_TO_EDGE, new Uint8Array(4));
    R = r;
  }

  function freeView(v) {
    if (!v || gl.isContextLost()) return;
    if (v.tex) gl.deleteTexture(v.tex);
    if (v.fb) gl.deleteFramebuffer(v.fb);
    if (v.ridges) gl.deleteTexture(v.ridges);
  }
  function makeTarget(v) {
    if (v.tex) { gl.deleteTexture(v.tex); gl.deleteFramebuffer(v.fb); }
    v.tex = tex(v.w, v.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.CLAMP_TO_EDGE);
    v.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, v.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok && !gl.isContextLost()) throw new Error('landscape: framebuffer incomplete');
    v.sw = v.sh = 0;
  }

  function freeAll() {
    if (!R || gl.isContextLost()) { R = null; views.clear(); figs.clear(); return; }
    for (const v of views.values()) freeView(v);
    views.clear();
    for (const t of figs.values()) gl.deleteTexture(t);
    figs.clear();
    gl.deleteProgram(R.sceneP.p);
    gl.deleteProgram(R.presentP.p);
    for (const t of [R.noise, R.blank]) if (t) gl.deleteTexture(t);
    gl.deleteVertexArray(R.vao);
    R = null;
  }

  try {
    build();
  } catch (err) {
    try { freeAll(); } catch { /* ignore */ }
    err.tainted = true;
    throw err;
  }

  function clearFence() {
    if (fence && !gl.isContextLost()) { try { gl.deleteSync(fence); } catch { /* ignore */ } }
    fence = null;
  }

  const onLost = (e) => {
    e.preventDefault(); // ask for a restore
    fence = null;
    R = null;
    views.clear();
    figs.clear();
    hooks.lost?.();
  };
  const onRestored = () => {
    try {
      build();
      hooks.restored?.();
    } catch {
      hooks.failed?.();
    }
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function bindTex(prog, unit, name, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t || R.blank);
    gl.uniform1i(prog.u(name), unit);
  }
  const sceneUV = (v) => {
    if (!v || !v.tex) return ZERO4;
    const sw = v.sw || v.w, sh = v.sh || v.h;
    return new Float32Array([sw / v.w, sh / v.h, (sw - 0.5) / v.w, (sh - 0.5) / v.h]);
  };

  return {
    mode: 'webgl',
    software,
    rendererName,
    maxTexture: maxTex,
    get ready() { return !!R && !gl.isContextLost(); },
    /** Resize the drawing buffer (CSS size is the page's business). */
    resize(w, h) {
      if (w === W && h === H) return;
      W = canvas.width = w;
      H = canvas.height = h;
    },
    /** Make sure view `id` has a w x h scene buffer. Returns true when it was (re)made (its painting is gone). */
    view(id, w, h) {
      if (!R) return false;
      w = Math.max(2, Math.min(maxTex, w | 0));
      h = Math.max(2, Math.min(maxTex, h | 0));
      let v = views.get(id);
      if (v && v.w === w && v.h === h && v.tex) return false;
      if (!v) { v = { fb: null, tex: null, w, h, sw: 0, sh: 0, ridges: null, ridgeW: 0 }; views.set(id, v); }
      v.w = w; v.h = h;
      makeTarget(v);
      return true;
    },
    dropView(id) { const v = views.get(id); if (v) { freeView(v); views.delete(id); } },
    hasView(id) { return !!views.get(id)?.tex; },
    ridges(id, data, samples) {
      const v = views.get(id);
      if (!R || !v) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (!v.ridges || v.ridgeW !== samples) {
        if (v.ridges) gl.deleteTexture(v.ridges);
        v.ridges = tex(samples, ROWS, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.CLAMP_TO_EDGE, data);
        v.ridgeW = samples;
      } else {
        gl.bindTexture(gl.TEXTURE_2D, v.ridges);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, samples, ROWS, gl.RGBA, gl.FLOAT, data);
      }
    },
    /** Upload a figure layer (premultiplied RGBA bytes, top row first), or free it (img = null). */
    figure(id, img) {
      if (!R) return false;
      const old = figs.get(id);
      if (old) { gl.deleteTexture(old); figs.delete(id); }
      if (!img) return true;
      const w = Math.min(maxTex, img.width), h = Math.min(maxTex, img.height);
      if (w !== img.width || h !== img.height) return false;
      gl.activeTexture(gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      const t = tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.CLAMP_TO_EDGE, new Uint8Array(img.data.buffer, img.data.byteOffset, w * h * 4));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      figs.set(id, t);
      return true;
    },
    hasFigure(id) { return figs.has(id); },
    /**
     * 0 when the GPU has finished the last presented frame, else how long (ms) it has been at it.
     * Non-blocking: a fence's status only changes between tasks, so this is polled once a frame.
     */
    busy() {
      if (!fence) return 0;
      let st = gl.SIGNALED;
      try { if (!gl.isContextLost()) st = gl.getSyncParameter(fence, gl.SYNC_STATUS); } catch { /* treat as done */ }
      if (st === gl.SIGNALED) { clearFence(); return 0; }
      return Math.max(1, performance.now() - fenceAt);
    },
    settle() {
      if (!R || gl.isContextLost()) return;
      // a 1-pixel readback is the one WebGL call that waits for the GPU (clientWaitSync cannot block)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      try { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); } catch { /* ignore */ }
      clearFence();
    },
    scene(id, U) {
      const v = views.get(id);
      if (!R || !v || !v.ridges || !v.tex) return;
      const P = R.sceneP;
      const ds = U.draft ? Math.min(1, Math.max(0.25, U.draftScale || 1)) : 1;
      v.sw = Math.max(2, Math.round(v.w * ds));
      v.sh = Math.max(2, Math.round(v.h * ds));
      gl.bindVertexArray(R.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, v.fb);
      gl.viewport(0, 0, v.sw, v.sh);
      gl.useProgram(P.p);
      bindTex(P, 0, 'uRidges', v.ridges);
      bindTex(P, 1, 'uNoise', R.noise);
      const fa = U.figA, fb = U.figB;
      bindTex(P, 2, 'uFigA', fa ? figs.get(fa.id) : null);
      bindTex(P, 3, 'uFigB', fb ? figs.get(fb.id) : null);
      gl.uniform4fv(P.u('uFigRA'), fa && figs.has(fa.id) ? fa.rect : ZERO4);
      gl.uniform4fv(P.u('uFigRB'), fb && figs.has(fb.id) ? fb.rect : ZERO4);
      gl.uniform4f(P.u('uFigKA'), fa && figs.has(fa.id) ? fa.k : 0, fa ? fa.plane : 0, fa ? fa.phase : 0, 0);
      gl.uniform4f(P.u('uFigKB'), fb && figs.has(fb.id) ? fb.k : 0, fb ? fb.plane : 0, fb ? fb.phase : 0, 0);
      gl.uniform3fv(P.u('uLayer'), U.feet);
      gl.uniform4fv(P.u('uView'), U.view);
      gl.uniform1f(P.u('uHs'), U.hs);
      gl.uniform4fv(P.u('uKeep'), U.keep || ZERO4);
      gl.uniform4fv(P.u('uNote'), U.note || ZERO4);
      gl.uniform1f(P.u('uLift'), U.lift || 0);
      gl.uniform1f(P.u('uArrive'), U.arrive);
      gl.uniform1f(P.u('uTide'), U.tide);
      gl.uniform4fv(P.u('uHz'), U.hz);
      gl.uniform1f(P.u('uHzK'), U.hzK);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    present(U) {
      if (!R) return;
      const P = R.presentP;
      gl.bindVertexArray(R.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(P.p);
      const wins = U.windows || [];
      const rect = new Float32Array(8), map = new Float32Array(8), suv = new Float32Array(8), fea = new Float32Array(8), kee = new Float32Array(8);
      for (let i = 0; i < 2; i++) {
        const w = wins[i];
        const v = w && views.get(w.id);
        if (!w || !v || !v.tex) { rect.set(NONE4, i * 4); continue; }
        rect.set(w.rect, i * 4);
        map.set(w.view, i * 4);
        suv.set(sceneUV(v), i * 4);
        fea.set(w.feather, i * 4);
        kee.set(w.keep || ZERO4, i * 4);
      }
      bindTex(P, 0, 'uWin0', wins[0] && views.get(wins[0].id)?.tex);
      bindTex(P, 1, 'uWin1', wins[1] && views.get(wins[1].id)?.tex);
      const hz = U.horizon && views.get(U.horizon.id);
      const hzK = hz && hz.tex ? U.horizon.k : 0;
      bindTex(P, 2, 'uHzTex', hz?.tex);
      bindTex(P, 3, 'uNoise', R.noise);
      gl.uniform4fv(P.u('uWinR'), rect);
      gl.uniform4fv(P.u('uWinM'), map);
      gl.uniform4fv(P.u('uWinS'), suv);
      gl.uniform4fv(P.u('uWinF'), fea);
      gl.uniform4fv(P.u('uWinK'), kee);
      gl.uniform1f(P.u('uHzK'), hzK);
      gl.uniform4fv(P.u('uHzS'), hz ? sceneUV(hz) : ZERO4);
      gl.uniform4fv(P.u('uHzM'), U.horizon ? U.horizon.view : ZERO4);
      gl.uniform1f(P.u('uAspect'), U.aspect);
      gl.uniform1f(P.u('uTime'), U.time);
      gl.uniform4fv(P.u('uVeil'), U.veil);
      gl.uniform1fv(P.u('uVeilS'), U.veilS);
      gl.uniform1fv(P.u('uVeilF'), U.veilF);
      gl.uniform1f(P.u('uVeilR'), U.veilR);
      gl.uniform4fv(P.u('uTrail'), U.trail);
      gl.uniform4fv(P.u('uWakeBox'), U.wakeBox);
      gl.uniform1f(P.u('uWakeR'), U.wakeR);
      gl.uniform4fv(P.u('uSweep'), U.sweep);
      gl.uniform1f(P.u('uSweepSeed'), U.sweepSeed);
      gl.uniform1f(P.u('uPx'), U.px);
      gl.uniform1f(P.u('uPanPx'), U.panPx);
      gl.uniform1f(P.u('uGrain'), U.grain);
      gl.uniform1f(P.u('uGrainPx'), U.grainPx);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!fence) {
        try { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); fenceAt = performance.now(); } catch { fence = null; }
      }
    },
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      clearFence();
      try { freeAll(); } catch { /* ignore */ }
    },
  };
}

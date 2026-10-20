// gl.ts — WebGL2 renderer for the landscape. Owns GL resources only; index.ts decides when to draw.
//
//   A *view* is one painting: a window onto the world (the page's strip, its closing) or the full viewport (the
//   desktop horizon). Each view has its own ridge texture and its own scene framebuffer.
//   view(id, w, h)     make sure view `id` has a w x h scene buffer (buffer px); dropView(id) frees it
//   ridges(id, d, n)   upload view `id`'s ridge rows (n columns)
//   figure(id, img)    upload a figure layer ({ width, height, data: premultiplied RGBA bytes, top row first }, or 4b
//                      { width, height, bitmap: an ImageBitmap, sprites?: [{ width, height, bitmap }] }) as a
//                      mipmapped texture (the mip levels give the bleed halo); its sprites (4b small life: Work's punt)
//                      as `${id}#${i}`, freed with it; figure(id, null) frees it
//   bitmaps            4b: true when this browser uploads a canvas's ImageBitmap premultiplied (probed once per context;
//                      index.ts then asks the figure worker for bitmaps, else for premultiplied bytes as in 4a)
//   scene(id, U)       expensive painting of view `id` -> its framebuffer. A frame in motion (U.draft) is painted into
//                      a corner of the framebuffer at U.draftScale; present() stretches it back.
//   present(U)         cheap pass to the screen: the windows at their live boxes, the horizon band, mist, grain
//   busy()             is the GPU still painting the last presented frame? (a fence; index.ts then skips a frame
//                      instead of queueing another behind it)
//   settle()           wait (blocking) until the GPU has finished everything drawn so far. Only for a page that is
//                      still hidden under the page wash: its first frame (shader compiles) lands there, not mid-reveal.
//
// Survives context loss: resources are rebuilt on 'webglcontextrestored' (views and figures are re-made by
// index.ts, which repaints everything). destroy() frees them but keeps the context alive, so a remount on the same
// canvas (React Strict Mode) works.

import { VERT, NOISE, NOISE_SIZE, SCENE, PRESENT } from './shaders';
import { ROWS, LAYERS } from './ridges';
import type { FigureImage, Renderer, RendererMemory } from './renderer';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|warp/i;
const NONE4 = new Float32Array([2, 2, -1, -1]);
const ZERO4 = new Float32Array(4);
const ALL_PLANES = new Float32Array([0, LAYERS - 1, 0, 0]);   // an ordinary view: every plane, opaque (4b depth layers set their own)
const NO_CROP = new Float32Array([0, 1, 0, 0]);                 // an ordinary view: the whole width of its ridges
const ZERO12 = new Float32Array(12);
const ZERO12A = new Float32Array(12);   // (the scroll's air: no petals)
const FULL_RECTS = new Float32Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
const NONE16 = new Float32Array([2, 2, -1, -1, 2, 2, -1, -1, 2, 2, -1, -1, 2, 2, -1, -1]);   // (no window into the painting)
const ZERO8 = new Float32Array(8);

/** What the engine does when the context is lost (a restore is asked for), restored, or cannot be rebuilt. */
export interface GLHooks {
  lost?(): void;
  restored?(): void;
  failed?(): void;
}
/** An error after a context was created: the canvas can no longer give a 2D context (see createGL). */
export type TaintedError = Error & { tainted?: boolean };
/** A linked program and its uniform locations (looked up once). */
interface Program {
  p: WebGLProgram;
  u(name: string): WebGLUniformLocation | null;
}
/** A view's GPU resources: its scene framebuffer (w x h; a draft paints sw x sh of it) and its ridge texture. */
interface View {
  fb: WebGLFramebuffer | null;
  tex: WebGLTexture | null;
  w: number;
  h: number;
  sw: number;
  sh: number;
  ridges: WebGLTexture | null;
  ridgeW: number;
}
/** The live GL resources (rebuilt after a context loss). */
interface Resources {
  vao: WebGLVertexArrayObject;
  noiseP: Program | null;
  sceneP: Program;
  presentP: Program;
  presentL: Program;
  noise: WebGLTexture;
  blank: WebGLTexture;
}

function detectRenderer(gl: WebGL2RenderingContext) {
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
 * @returns null when WebGL2 is unavailable (the canvas is untouched).
 * Throws (err.tainted = true) if a context was created but could not be set up: the canvas can
 * then no longer give a 2D context, and the caller paints the fallback on a fresh canvas.
 */
export function createGL(canvas: HTMLCanvasElement, hooks: GLHooks): Renderer | null {
  let context: WebGL2RenderingContext | null = null;
  try {
    context = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power',
    });
  } catch { context = null; }
  if (!context) return null;
  const gl = context;   // (typed: the helper functions below see a context, never a possible null)
  if (gl.isContextLost()) {
    const err: TaintedError = new Error('landscape: context lost at init');
    err.tainted = true;
    throw err;
  }

  const rendererName = detectRenderer(gl);
  const software = SOFTWARE.test(rendererName);
  const maxTex: number = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  let R: Resources | null = null;   // live GL resources
  let W = 0, H = 0;       // drawing-buffer size
  // a long jump's cross-dissolve (the silk veil): the last frame before the splice, copied off the drawing buffer
  let prev: WebGLTexture | null = null, prevW = 0, prevH = 0;
  const views = new Map<string, View>();
  const figs = new Map<string, WebGLTexture>();   // id -> texture
  const figBytes = new Map<string, number>();     // id -> bytes (QA: memory())
  let fence: WebGLSync | null = null;   // set after a present: has the GPU finished that frame? (see busy())
  let fenceAt = 0;
  const px1 = new Uint8Array(4);   // settle()'s readback
  let bitmapsOK = false;  // 4b: an ImageBitmap of a 2D canvas uploads premultiplied here (probeBitmaps)

  // (WebGL's create* return null only on a lost context, where every later call is a no-op: the ! below)
  function compile(type: GLenum, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`landscape: shader compile failed\n${log}`);
    }
    return s;
  }
  function program(frag: string): Program {
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
    const locs = new Map<string, WebGLUniformLocation | null>();
    return {
      p,
      u(name) {
        if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name));
        return locs.get(name) as WebGLUniformLocation | null;
      },
    };
  }
  function tex(w: number, h: number, internal: GLenum, format: GLenum, type: GLenum, wrap: GLenum, data: ArrayBufferView | null = null): WebGLTexture {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  // 4b: a figure layer (or a life sprite) arrives as an ImageBitmap of the worker's canvas: no getImageData readback.
  // The shader wants premultiplied texels. (The WebGL spec has the UNPACK_* flags ignored for an ImageBitmap, whose own
  // premultiply option decides, and transferToImageBitmap leaves it at 'default': so the flags are set for the browsers
  // that honour them, and probeBitmaps() checks what this one does.)
  function upBitmap(bmp: TexImageSource) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
  }
  // One 1x1 probe per context, made before anything else is queued (so its readback waits for nothing): does a canvas's
  // ImageBitmap upload premultiplied here? If not, index.ts asks the worker for premultiplied bytes, as in 4a.
  function probeBitmaps() {
    bitmapsOK = false;
    if (typeof OffscreenCanvas !== 'function') return;
    let t: WebGLTexture | null = null, fb: WebGLFramebuffer | null = null;
    try {
      const oc = new OffscreenCanvas(1, 1);
      const cx = oc.getContext('2d');
      if (cx && typeof oc.transferToImageBitmap === 'function') {
        cx.fillStyle = 'rgba(200, 100, 50, 0.5)';
        cx.fillRect(0, 0, 1, 1);
        const bmp = oc.transferToImageBitmap();
        t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        upBitmap(bmp);
        bmp.close?.();
        fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const px = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        bitmapsOK = Math.abs(px[0] - 100) <= 3 && Math.abs(px[1] - 50) <= 3 && Math.abs(px[3] - 128) <= 3;
      }
    } catch { bitmapsOK = false; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (fb) gl.deleteFramebuffer(fb);
    if (t) gl.deleteTexture(t);
  }

  function build() {
    const r = {} as Resources;
    probeBitmaps();
    r.vao = gl.createVertexArray()!;
    gl.bindVertexArray(r.vao);
    r.noiseP = program(NOISE);
    r.sceneP = program(SCENE);
    r.presentP = program(PRESENT);
    r.presentL = program(PRESENT.replace('#define LIFE ', '#define LIFE_ON 1\n#define LIFE '));   // 4b: with small life
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

  // a figure layer's (or a sprite's) mipmapped texture, from premultiplied bytes or an ImageBitmap (closed after)
  function figTex(img: FigureImage, w: number, h: number): WebGLTexture {
    gl.activeTexture(gl.TEXTURE0);
    let t: WebGLTexture;
    if (img.bitmap) {
      t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      upBitmap(img.bitmap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try { (img.bitmap as ImageBitmap).close?.(); } catch { /* ignore */ }
    } else {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      t = tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.CLAMP_TO_EDGE, new Uint8Array(img.data!.buffer, img.data!.byteOffset, w * h * 4));
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    return t;
  }
  function closeBitmaps(img: FigureImage | null) {
    try { (img?.bitmap as ImageBitmap | undefined)?.close?.(); for (const s of img?.sprites || []) s?.bitmap?.close?.(); } catch { /* ignore */ }
  }

  function freeView(v: View) {
    if (!v || gl.isContextLost()) return;
    if (v.tex) gl.deleteTexture(v.tex);
    if (v.fb) gl.deleteFramebuffer(v.fb);
    if (v.ridges) gl.deleteTexture(v.ridges);
  }
  function makeTarget(v: View) {
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
    gl.deleteProgram(R.presentL.p);
    for (const t of [R.noise, R.blank]) if (t) gl.deleteTexture(t);
    if (prev) gl.deleteTexture(prev);
    prev = null; prevW = prevH = 0;
    gl.deleteVertexArray(R.vao);
    R = null;
  }

  try {
    build();
  } catch (err) {
    try { freeAll(); } catch { /* ignore */ }
    (err as TaintedError).tainted = true;
    throw err;
  }

  function clearFence() {
    if (fence && !gl.isContextLost()) { try { gl.deleteSync(fence); } catch { /* ignore */ } }
    fence = null;
  }

  const onLost = (e: Event) => {
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

  function bindTex(prog: Program, unit: number, name: string, t: WebGLTexture | null | undefined) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t || R!.blank);
    gl.uniform1i(prog.u(name), unit);
  }
  const sceneUV = (v: View | null | undefined) => {
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
    /** QA: bytes held per view (its scene buffer, RGBA8, and its ridge rows, RGBA16F) and by the figure layers. */
    memory() {
      const out: RendererMemory = { total: 0, views: {}, figures: 0 };   // (figure layers: with their mip levels, x 4/3)
      for (const [id, v] of views) {
        const b = (v.tex ? v.w * v.h * 4 : 0) + (v.ridges ? v.ridgeW * ROWS * 8 : 0);
        out.views[id] = { w: v.w, h: v.h, bytes: b };
        out.total += b;
      }
      for (const [id, b] of figBytes) if (figs.has(id)) out.figures += b;
      out.total += out.figures;
      return out;
    },
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
    /** Upload a figure layer (premultiplied RGBA bytes, top row first; or an ImageBitmap, 4b, with its life sprites),
     *  or free it (img = null). The bitmaps are closed once uploaded. */
    figure(id, img) {
      if (!R) { closeBitmaps(img); return false; }
      for (const k of [...figs.keys()]) if (k === id || k.startsWith(`${id}#`)) { gl.deleteTexture(figs.get(k)!); figs.delete(k); }
      if (!img) return true;
      const w = Math.min(maxTex, img.width), h = Math.min(maxTex, img.height);
      if (w !== img.width || h !== img.height) { closeBitmaps(img); return false; }
      figs.set(id, figTex(img, w, h));
      figBytes.set(id, Math.round(w * h * 4 * 4 / 3));
      (img.sprites || []).forEach((s, i) => {
        if (!s || !(s.width > 0) || s.width > maxTex || s.height > maxTex) { s?.bitmap?.close?.(); return; }
        figs.set(`${id}#${i}`, figTex(s, s.width, s.height));
        figBytes.set(`${id}#${i}`, Math.round(s.width * s.height * 4 * 4 / 3));
      });
      return true;
    },
    get bitmaps() { return bitmapsOK; },
    hasFigure(id) { return figs.has(id); },
    /**
     * 0 when the GPU has finished the last presented frame, else how long (ms) it has been at it.
     * Non-blocking: a fence's status only changes between tasks, so this is polled once a frame.
     */
    busy() {
      if (!fence) return 0;
      let st: GLenum = gl.SIGNALED;
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
      const half = U.half === 0 || U.half === 1 ? U.half : -1;   // (a window's two depth layers share one buffer)
      v.sw = half >= 0 ? v.w : Math.max(2, Math.round(v.w * ds));
      v.sh = half >= 0 ? v.h : Math.max(2, Math.round(v.h * ds));
      gl.bindVertexArray(R.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, v.fb);
      if (half >= 0) gl.viewport(0, half * Math.floor(v.h / 2), v.w, Math.floor(v.h / 2));
      else gl.viewport(0, 0, v.sw, v.sh);
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
      gl.uniform1f(P.u('uStillL'), U.stillL || 0);
      gl.uniform1f(P.u('uMorn'), U.morn ?? 9);
      gl.uniform1f(P.u('uTide'), U.tide);
      gl.uniform4fv(P.u('uHz'), U.hz);
      gl.uniform1f(P.u('uHzK'), U.hzK);
      gl.uniform4fv(P.u('uPlanes'), U.planes || ALL_PLANES);
      gl.uniform4fv(P.u('uCrop'), U.crop || NO_CROP);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    present(U) {
      if (!R) return;
      const P = U.life ? R.presentL : R.presentP;   // (4b: the program with small life only while some is on screen)
      gl.bindVertexArray(R.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(P.p);
      const wins = U.windows || [];
      const rect = new Float32Array(8), map = new Float32Array(8), suv = new Float32Array(8), fea = new Float32Array(8), kee = new Float32Array(8), sink = new Float32Array(8)
      const nuv = new Float32Array(8), part = new Float32Array(8);   // (each window's front depth layer)
      for (let i = 0; i < 2; i++) {
        const w = wins[i];
        const v = w && views.get(w.id);
        if (!w || !v || !v.tex) { rect.set(NONE4, i * 4); continue; }
        rect.set(w.rect, i * 4);
        map.set(w.view, i * 4);
        suv.set(sceneUV(v), i * 4);
        fea.set(w.feather, i * 4);
        kee.set(w.keep || ZERO4, i * 4);
        sink[i * 4 + 1] = w.sink || 0;
        const nv = w.near ? views.get(w.near) : null;
        if (nv && nv.tex && w.part) { nuv.set(sceneUV(nv), i * 4); part.set(w.part, i * 4); }
      }
      bindTex(P, 0, 'uWin0', wins[0] && views.get(wins[0].id)?.tex);
      bindTex(P, 1, 'uWin1', wins[1] && views.get(wins[1].id)?.tex);
      // the windows' front depth layers (units 11, 12), when parted
      bindTex(P, 11, 'uWinN0', part[0] > 0 && wins[0]?.near ? views.get(wins[0].near)?.tex : null);
      bindTex(P, 12, 'uWinN1', part[4] > 0 && wins[1]?.near ? views.get(wins[1].near)?.tex : null);
      gl.uniform4fv(P.u('uWinNS'), nuv);
      gl.uniform4fv(P.u('uWinP'), part);
      const hz = U.horizon && views.get(U.horizon.id);
      const hzK = hz && hz.tex ? U.horizon!.k : 0;
      bindTex(P, 2, 'uHzTex', hz?.tex);
      bindTex(P, 3, 'uNoise', R.noise);
      gl.uniform4fv(P.u('uWinR'), rect);
      gl.uniform4fv(P.u('uWinM'), map);
      gl.uniform4fv(P.u('uWinS'), suv);
      gl.uniform4fv(P.u('uWinF'), fea);
      gl.uniform4fv(P.u('uWinK'), kee);
      gl.uniform4fv(P.u('uWinO'), sink);
      gl.uniform1f(P.u('uHzK'), hzK);
      gl.uniform4fv(P.u('uHzS'), hz ? sceneUV(hz) : ZERO4);
      gl.uniform4fv(P.u('uHzM'), U.horizon ? U.horizon.view : ZERO4);
      gl.uniform1f(P.u('uAspect'), U.aspect);
      gl.uniform1f(P.u('uTime'), U.time);
      gl.uniform1f(P.u('uStillL'), U.stillL || 0);
      gl.uniform1f(P.u('uMorn'), U.morn ?? 9);
      gl.uniform4fv(P.u('uVeil'), U.veil);
      gl.uniform1fv(P.u('uVeilS'), U.veilS);
      gl.uniform1fv(P.u('uVeilF'), U.veilF);
      gl.uniform1f(P.u('uVeilR'), U.veilR);
      gl.uniform4fv(P.u('uTrail'), U.trail);
      gl.uniform4fv(P.u('uWakeBox'), U.wakeBox);
      gl.uniform1f(P.u('uWakeR'), U.wakeR);
      gl.uniform4fv(P.u('uSweep'), U.sweep);
      gl.uniform1f(P.u('uSweepSeed'), U.sweepSeed);
      gl.uniform1f(P.u('uSweepK'), U.sweepKeep ?? 0);
      const hold = prev && prevW === W && prevH === H ? U.hold ?? 0 : 0;
      gl.uniform1f(P.u('uHold'), hold);
      bindTex(P, 10, 'uPrev', hold > 0 ? prev : null);
      gl.uniform1f(P.u('uPx'), U.px);
      gl.uniform1f(P.u('uPanPx'), U.panPx);
      gl.uniform1f(P.u('uGrain'), U.grain);
      gl.uniform1f(P.u('uGrainPx'), U.grainPx);
      // 4b: the living ground's depth layers (units 4-6) and the living veils
      const st = U.stage;
      const sv = st ? st.ids.map((id) => views.get(id)) : [];
      const stOn = !!st && sv.length === 3 && !!sv[0]?.tex;
      const ss = new Float32Array(12);
      for (let i = 0; i < 3; i++) if (stOn && sv[i]?.tex) ss.set(sceneUV(sv[i]), i * 4);
      bindTex(P, 4, 'uSt0', stOn ? sv[0]!.tex : null);
      bindTex(P, 5, 'uSt1', stOn ? sv[1]?.tex : null);
      bindTex(P, 6, 'uSt2', stOn ? sv[2]?.tex : null);
      gl.uniform4fv(P.u('uStS'), ss);
      gl.uniform4fv(P.u('uStO'), stOn ? st.offsets : ZERO12);
      gl.uniform4fv(P.u('uStR'), stOn && st.rects ? st.rects : FULL_RECTS);
      gl.uniform4fv(P.u('uStM'), stOn ? st.view : ZERO4);
      gl.uniform4fv(P.u('uSt'), stOn ? st.k : ZERO4);
      gl.uniform4fv(P.u('uSea'), stOn ? st.sea : ZERO4);
      gl.uniform4fv(P.u('uStC'), stOn && st.cloud ? st.cloud : ZERO4);
      gl.uniform4fv(P.u('uStV'), stOn && st.curt ? st.curt : ZERO4);
      gl.uniform4fv(P.u('uStX'), stOn && st.air ? st.air : ZERO4);   // (an inner place's air, soft crops, footer)
      gl.uniform4fv(P.u('uStF'), stOn && st.foot ? st.foot : ZERO4);
      gl.uniform4fv(P.u('uStG'), stOn && st.grade ? st.grade : ZERO4);
      gl.uniform4fv(P.u('uStK'), stOn && st.rule ? st.rule : ZERO4);   // (the row rules' end)
      gl.uniform4fv(P.u('uLive'), U.live || ZERO4);
      gl.uniform4fv(P.u('uLive2'), U.live2 || ZERO4);
      // the windows into the painting (elements.ts glimpses; units 13, 14: each window's own view, its back
      // in the lower half and its front in the upper)
      const G = U.glimpse;
      const gv = [0, 1].map((i) => (G && G.ids[i] ? views.get(G.ids[i]) : null));
      const gOn = !!G && !!gv[0]?.tex;
      const gs = new Float32Array(8);
      for (let i = 0; i < 2; i++) { const v = gv[i]; if (gOn && v && v.tex) gs.set([1 / v.w, 1 / v.h, 0, 0], i * 4); }
      bindTex(P, 13, 'uGl0', gOn ? gv[0]!.tex : null);
      bindTex(P, 14, 'uGl1', gOn && gv[1]?.tex ? gv[1]!.tex : null);
      const gr = new Float32Array(NONE16.subarray(0, 8));
      if (gOn) { gr.set(G!.rects); if (!gv[1]?.tex) gr.set(NONE4, 4); }
      gl.uniform4fv(P.u('uGlS'), gs);
      gl.uniform4f(P.u('uGlK'), gOn ? 1 : 0, U.paperOut ? 1 : 0, 0, 0);
      gl.uniform4fv(P.u('uGlR'), gr);
      gl.uniform4fv(P.u('uGlA'), gOn ? G!.a : ZERO8);
      gl.uniform4fv(P.u('uGlB2'), gOn ? G!.b : ZERO8);
      gl.uniform4fv(P.u('uGlF2'), gOn ? G!.f : ZERO8);
      gl.uniform4fv(P.u('uGlC'), gOn ? G!.c : ZERO8);
      gl.uniform4fv(P.u('uGlD'), gOn ? G!.d : ZERO8);
      gl.uniform4fv(P.u('uGlM'), gOn ? G!.m : ZERO8);
      // the scroll's air (elements.ts air)
      const A = U.air;
      gl.uniform4fv(P.u('uAir'), A ? A.a : ZERO4);
      gl.uniform4fv(P.u('uAir2'), A ? A.b : ZERO4);
      gl.uniform4fv(P.u('uAir3'), A ? A.c : ZERO4);
      gl.uniform4fv(P.u('uAirP'), A ? A.petals : ZERO12A);
      gl.uniform4fv(P.u('uAirQ'), A ? A.petalsB : ZERO12A);
      // 4b small life (the life program only; units 7-9): its table, the ridges of the view it lies in (where its water
      // is), the drifting boat's sprite and the figure layer the water's shimmer keeps off (boats, the bridge)
      const lf = U.life;
      if (lf) {
        bindTex(P, 7, 'uLifeRid', (lf.ridge && views.get(lf.ridge)?.ridges) || null);
        bindTex(P, 8, 'uLifeSpr', lf.sprite ? figs.get(lf.sprite) : null);
        bindTex(P, 9, 'uLifeFig', lf.fig ? figs.get(lf.fig) : null);
        gl.uniform4fv(P.u('uLifeU'), lf.union);
        gl.uniform4fv(P.u('uLifeT'), lf.starts);
        gl.uniform4fv(P.u('uLifeR'), lf.rect);
        gl.uniform4fv(P.u('uLifeA'), lf.a);
        gl.uniform4fv(P.u('uLifeB'), lf.b);
        gl.uniform4fv(P.u('uLifeK'), lf.k);
        gl.uniform4fv(P.u('uLifeFigR'), lf.fig && figs.has(lf.fig) ? lf.figR : ZERO4);
        // the stirred water, the plum's gust (elements.ts)
        gl.uniform4fv(P.u('uStir'), lf.stir);
        gl.uniform4fv(P.u('uStirK'), lf.stirK);
        gl.uniform4fv(P.u('uGust'), lf.gust);
        gl.uniform4fv(P.u('uGust2'), lf.gust2);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (U.grab) {
        // keep this frame for a long jump's cross-dissolve (only while one is about to splice)
        gl.activeTexture(gl.TEXTURE0 + 10);
        if (!prev || prevW !== W || prevH !== H) {
          if (prev) gl.deleteTexture(prev);
          prev = tex(W, H, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, gl.CLAMP_TO_EDGE);   // (the drawing buffer has no alpha)
          prevW = W; prevH = H;
        } else gl.bindTexture(gl.TEXTURE_2D, prev);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, W, H);
      }
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

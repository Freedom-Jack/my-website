#!/usr/bin/env python3
"""The footer story map's five scene stills, cut at build time from the real engine (DESIGN 11.B).

    python3 tools/build-stills.py                    # needs the demo server: python3 _tools/serve.py 4173
    python3 tools/build-stills.py --base http://localhost:4181 --places home,work
    python3 tools/build-stills.py --preview <scratchpad>/stills    # also keep the raw crops (outside the repo)
    python3 tools/build-stills.py --check            # no browser: exit 1 when the stills are stale

What it does, per mapped place (Home 0, Work 1, Writing 3, Resume 4, Contact 5; the road 2 has no page, the 404 lies
off the map):
  1. Opens the place's real page at 1440 x 900 (DPR 2) in headless Chrome (tools/qa/cdp.py) and lets it settle.
  2. Hides the page's words (main is hidden except the strip art; the header and the "Draft art" note go), then
     remounts the page's own engine on its own canvas with the page's own config and windows (main.js `config` and
     `site.targets(main)`), but with no veils, keep-outs or wake and a FIXED internal resolution (`quality`, the
     engine's QA option) and no ambient drift. That is the painting alone, as places.py --pure shows it, at full
     resolution (headless Chrome paints on the CPU, where the adaptive engine would drop to 0.5-0.6 and keep
     changing), with the mist at rest: the same inputs give the same files, byte for byte.
  3. Waits on the engine's own stats() (no fixed delays): nothing pending, every figure layer drawn and faded in,
     the newest scene a full-quality one.
  4. Reads the strip's framing (stats().framing.strip: worldLeft, worldTop, scale) and turns the place's crop rect
     below (world units: stretches x scene heights) into strip pixels; a rect outside the strip window fails.
  5. Captures that region at the device pixel ratio, then in the page: steps it down (halving, then one
     high-quality drawImage) to the tile at 1x and 2x, divides out the paper (PAPER becomes white: the footer
     shows the stills with mix-blend-mode: multiply, so they melt into whatever paper is behind them, the live
     canvas's grain included) and encodes WebP (canvas.toDataURL('image/webp', WEBP_Q)).
  6. Writes assets/img/scenes/<place>@1x.webp and @2x.webp, and manifest.json beside them: the hash of every
     generating input and of each file.

--check recomputes the input hash (the engine: assets/js/landscape/**/*.js, palette.js included; main.js, which
mounts it; the mapped pages' <body> config; the strip-height tokens, which size the windows; this tool's crop table
and settings), compares it and each file's hash with the manifest, checks the size caps, and checks that layout.css
and _template.html still carry this table's tile sizes, focus and foot fades. Exit 1 = stale: regenerate.
THE STILLS MUST BE REGENERATED AFTER ANY ENGINE OR SCENE CHANGE (python3 tools/build-stills.py).

Screenshots and previews never go into the repo (DESIGN 1); only the stills themselves do.
Standard library only (Python 3.9+), plus Google Chrome.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time

sys.dont_write_bytecode = True     # no __pycache__ in the repo
HERE = os.path.dirname(os.path.abspath(__file__))          # design-demo/tools
DEMO = os.path.dirname(HERE)                               # design-demo
sys.path.insert(0, os.path.join(HERE, "qa"))
import qa_common as q   # noqa: E402
import cdp              # noqa: E402

# ------------------------------------------------------------------------------------------------ the crop table
# Each place's still is the region a painter would choose to stand for it, cut from its page's opening strip, plus
# the mist and far ranges at its sides that the footer needs to meet its neighbours (the footer never shows a whole
# still: a soft window, layout.css, shows the part between the midpoints to its neighbours).
# rect = [u0, u1, y0, y1]: world x in stretches (stretch k spans k..k+1) and scene heights (0 = the bottom of the
# scene, y up), the units of compose.js and stats().framing. w = the tile's width at 1x (CSS px; every tile is
# TILE_H tall), and every rect has its tile's aspect: (u1 - u0) * 1.6 / (y1 - y0) = w / TILE_H (1.6 = scene heights
# per stretch). The y ranges (hence each place's scale) are the ones the art lead passed for faithfulness.
# focus = where the place's centre lies across the still (0..1): the footer pins that point over the place's label
# and tick (layout.css --focus). fade_b = how far up (0..1 of the tile) the still dissolves at its foot
# (layout.css --fade-b). The side feathers are the footer's windows (layout.css), not the still's.
# Each rect must hold the footer's widest window (layout.css: at the narrowest art-to-column ratio, .37, and the
# feathers' slant): Home u .30-1.0; Work 1.07-2.0 (its left edge stops after the seam crag, u 1.0-1.04); Writing
# 3.12-4.1 (its left is the far range and its reflection: the road's faint thread); Resume 4.29-4.81; Contact
# 5.39-6.0.
PLACES = [
    {"name": "home", "page": "/", "stretch": 0, "w": 252,
     # his two massifs (the host u .65, the near peaks u .88-1.0), the hut (u .846) and the traveller (u .80);
     # the window's own right edge (u 1.0) is the near peaks' cut in the hero, so the footer dissolves them
     "rect": [0.001, 1.0, 0.156, 0.60], "focus": 0.76, "fade_b": 0.10},
    {"name": "work", "page": "/work/", "stretch": 1, "w": 355,
     # the rainbow bridge (u 1.48-1.67) centred in its town, the boats, the willows, the hills and the needle crest;
     # the town's left end and the river to u 1.05 (Home's side), its right end to the window's edge (the road)
     "rect": [1.0491, 2.0, 0.19, 0.49], "focus": 0.54, "fade_b": 0.12},
    {"name": "writing", "page": "/writing/", "stretch": 3, "w": 386,
     # the far peak (u 3.76), its whole reflection and the pavilion on its promontory (u 3.93); on its left the
     # lake's far range and its reflection, to the window's edge (u 3.1)
     "rect": [3.1005, 4.1, 0.15, 0.44], "focus": 0.71, "fade_b": 0.16},
    {"name": "resume", "page": "/resume/", "stretch": 4, "w": 317,
     # the two terraced hills (u 4.35-4.78) with the farmhouse (u 4.63) under the far range (the doc strip: low),
     # with mist and the far range at both sides
     "rect": [4.25, 4.85004, 0.178, 0.39], "focus": 0.52, "fade_b": 0.22},
    {"name": "contact", "page": "/contact/", "stretch": 5, "w": 252,
     # the ferry (u 5.64) at the jetty (to u 5.8) and his mountain's echo on the far shore (u 5.84)
     "rect": [5.3025, 6.0, 0.18, 0.49], "focus": 0.62, "fade_b": 0.14},
]
TILE_H = 70                    # every still's height at 1x, CSS px (the footer shows it 44-74 px tall); 2x is 140
DENSITIES = (1, 2)
WEBP_Q = 0.85                  # canvas.toDataURL('image/webp', q)
VIEWPORT = [1440, 900, 2, False]
ENGINE_QUALITY = 1.5           # the engine's fixed internal resolution (its buffer's long side is capped at 1920 px)
PALETTE = "misted"             # the site's default palette (the demo's compare panel is not baked)
PAPER = (239, 241, 238)        # --paper and the shader's PAPER (#EFF1EE); divided out to white
CAP_FILE = 16 * 1024           # bytes, any one still
CAP_TOTAL = 60 * 1024          # bytes, all ten
OUT_DIR = os.path.join(DEMO, "assets", "img", "scenes")
MANIFEST = os.path.join(OUT_DIR, "manifest.json")

# ------------------------------------------------------------------------------------------------ in the page
HIDE_CSS = """
main { visibility: hidden !important; }
main [data-landscape="strip"] { visibility: visible !important; }
.site-header, .site-footer, .compare, .skip-link { visibility: hidden !important; }
.strip__note { display: none !important; }
"""
# Remount the page's own engine: the page's own config and windows, no veils / keep-outs / wake, fixed resolution, and
# no ambient drift, so the mist stays at the engine's starting clock (what a page shows as it opens) and the same
# inputs always give the same stills, byte for byte. (Not `still: true`: tried on 2026-10-15, the stilled engine
# left Home's, Writing's and Contact's figure layers unshown: no hut, no pavilion, no ferry.)
REMOUNT_JS = """(async (Q, palette) => {
  const m = await import('/assets/js/main.js');
  await m.ready;
  const eng = await import('/assets/js/landscape/index.js');
  const canvas = document.querySelector('canvas.landscape');
  const main = document.getElementById('main');
  if (!canvas || !main || typeof eng.mountLandscape !== 'function' || typeof m.site?.targets !== 'function') return 'no-engine';
  const c = m.config;
  const h = eng.mountLandscape(canvas, {
    stretch: c.stretch, distance: c.distance, presence: c.presence, palette,
    ...m.site.targets(main), ground: '', veil: [], keepout: [], wake: [],   // (the strip, also on a living page)
    arrival: 'none', quality: Q, pointer: false, ambient: false,
  });
  window.__stillsHandle = h;
  return h.mode;
})"""
# Settled: nothing pending, every figure layer drawn AND faded in, the newest scene a full one.
SETTLE_JS = """(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h = window.__stillsHandle;
  if (!h) return false;
  const s = h.stats();
  if (s.arriving || s.pending || s.sweeping || s.deferred) return false;
  if (Object.values(s.figures || {}).includes('pending')) return false;
  if ((s.figureSlots || []).some((f) => f.k < 0.999)) return false;
  if (!(s.fullAt > 0) || s.draftAt > s.fullAt || performance.now() - s.draftAt < 400) return false;
  return 'settled';
})()"""
BOX_JS = """(() => { const e = document.querySelector('main [data-landscape="strip"]'); if (!e) return null;
  const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()"""
# Scale down (halving with a high-quality filter, then one last drawImage to the exact size), divide out the paper,
# encode WebP. Returns { '<density>': base64 } plus the source size.
PROCESS_JS = """(async (b64, sizes, paper, quality) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const draw = (src, sw, sh, w, h) => {
    const c = canvasOf(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    return c;
  };
  const out = { src: [img.naturalWidth, img.naturalHeight] };
  for (const [d, w, h] of sizes) {
    let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
    while (sw >= w * 4 && sh >= h * 4) {
      const nw = Math.round(sw / 2), nh = Math.round(sh / 2);
      src = draw(src, sw, sh, nw, nh); sw = nw; sh = nh;
    }
    const c = draw(src, sw, sh, w, h), x = c.getContext('2d');
    const id = x.getImageData(0, 0, w, h), p = id.data;
    const k = paper.map((v) => 255 / v);
    let paperish = 0;
    for (let i = 0; i < p.length; i += 4) {
      p[i] = Math.min(255, Math.round(p[i] * k[0]));
      p[i + 1] = Math.min(255, Math.round(p[i + 1] * k[1]));
      p[i + 2] = Math.min(255, Math.round(p[i + 2] * k[2]));
      p[i + 3] = 255;
      if (p[i] + p[i + 1] + p[i + 2] >= 750) paperish++;
    }
    x.putImageData(id, 0, 0);
    const url = c.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
    out[d] = url.slice('data:image/webp;base64,'.length);
    out['paper' + d] = Math.round(1000 * paperish / (w * h)) / 1000;
  }
  return out;
})"""


# ------------------------------------------------------------------------------------------------ inputs and hashes
def rel(p):
    return os.path.relpath(p, DEMO).replace(os.sep, "/")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def page_file(route):
    return os.path.join(DEMO, route.strip("/"), "index.html") if route != "/" else os.path.join(DEMO, "index.html")


def inputs():
    """Every input that shapes the stills, as (label, sha256) pairs, sorted."""
    items = []
    land = os.path.join(DEMO, "assets", "js", "landscape")
    for root, _, files in os.walk(land):
        for f in files:
            if f.endswith(".js"):
                p = os.path.join(root, f)
                items.append((rel(p), sha(open(p, "rb").read())))
    main_js = os.path.join(DEMO, "assets", "js", "main.js")
    items.append((rel(main_js), sha(open(main_js, "rb").read())))
    for pl in PLACES:     # only the page's config, not its words: <body data-stretch ... data-presence ...>
        body = re.search(r"<body\s[^>]*>", open(page_file(pl["page"]), encoding="utf-8").read())   # not "<body>" in a comment
        items.append((rel(page_file(pl["page"])) + "#body", sha((body.group(0) if body else "").encode())))
    # the strip heights size the windows, hence their framings: each --strip-* / --closing-* line with its media query
    media, lines = "", []
    for l in open(os.path.join(DEMO, "assets", "css", "tokens.css"), encoding="utf-8").read().splitlines():
        if "@media" in l:
            media = l.strip()
        elif re.match(r"\s*--(strip|closing)-", l):
            lines.append(f"{media} | {l.strip()}")
    items.append(("assets/css/tokens.css#strip-heights", sha("\n".join(lines).encode())))
    settings = {"places": PLACES, "tile": TILE_H, "densities": DENSITIES, "webp": WEBP_Q, "viewport": VIEWPORT,
                "quality": ENGINE_QUALITY, "palette": PALETTE, "paper": PAPER,
                "js": [HIDE_CSS, REMOUNT_JS, SETTLE_JS, PROCESS_JS]}
    items.append(("tools/build-stills.py#settings", sha(json.dumps(settings, sort_keys=True).encode())))
    return sorted(items)


def input_hash(items):
    return sha("\n".join(f"{a} {b}" for a, b in items).encode())


def out_name(pl, d):
    return f"{pl['name']}@{d}x.webp"


def plain_webp(data):
    """Chrome's encoder wraps the image in VP8X with an ICC profile (sRGB, ~0.5 KB). Keep only the lossy bitstream
    ('VP8 ' in a bare RIFF/WEBP: untagged means sRGB): smaller, and no metadata chunk of any kind."""
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("not a WebP")
    chunks, i = {}, 12
    while i + 8 <= len(data):
        tag, n = data[i:i + 4], int.from_bytes(data[i + 4:i + 8], "little")
        chunks.setdefault(tag, data[i + 8:i + 8 + n])
        i += 8 + n + (n & 1)
    if b"VP8 " not in chunks or b"ALPH" in chunks or b"ANIM" in chunks:
        return data                                   # not the simple lossy case: leave it whole
    body = chunks[b"VP8 "]
    vp8 = b"VP8 " + len(body).to_bytes(4, "little") + body + (b"\0" if len(body) & 1 else b"")
    return b"RIFF" + (4 + len(vp8)).to_bytes(4, "little") + b"WEBP" + vp8


# ------------------------------------------------------------------------------------------------ --check
def css_values():
    """The footer's per-place values in layout.css: { stretch: {--focus, --fade-b, ...} } (every rule for that place's
    scene, merged; the per-width window rules carry other properties)."""
    css = open(os.path.join(DEMO, "assets", "css", "layout.css"), encoding="utf-8").read()
    found = {}
    for m in re.finditer(r"\.story-map__scene\[data-stretch='(\d)'\]\s*\{([^}]*)\}", css):
        decl = dict((k.strip(), v.strip()) for k, v in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", m.group(2)))
        found.setdefault(int(m.group(1)), {}).update(decl)
    return found


def pct(v):
    return f"{round(v * 100)}%"


def consistency():
    """Does the footer's CSS and markup still match this table? Returns a list of problems."""
    bad = []
    css = css_values()
    for pl in PLACES:
        want = {"--focus": pct(pl["focus"]), "--fade-b": pct(pl["fade_b"])}
        have = css.get(pl["stretch"], {})
        for k, v in want.items():
            if have.get(k) != v:
                bad.append(f"layout.css .story-map__scene[data-stretch='{pl['stretch']}'] {k} is {have.get(k)}, the crop table says {v}")
    tpl = open(os.path.join(DEMO, "_template.html"), encoding="utf-8").read()
    for pl in PLACES:
        m = re.search(r"<img\b[^>]*src=\"/assets/img/scenes/%s@1x\.webp\"[^>]*>" % re.escape(pl["name"]), tpl)
        if not m:
            bad.append(f"_template.html has no story-map still for {pl['name']}")
            continue
        tag = m.group(0)
        if f'width="{pl["w"]}"' not in tag or f'height="{TILE_H}"' not in tag:
            bad.append(f"_template.html: the {pl['name']} still is not width=\"{pl['w']}\" height=\"{TILE_H}\"")
        if f'{pl["name"]}@2x.webp 2x' not in tag:
            bad.append(f"_template.html: the {pl['name']} still has no @2x in its srcset")
    return bad


def check():
    problems = []
    try:
        man = json.load(open(MANIFEST))
    except (OSError, ValueError) as e:
        print(f"stills: no readable manifest ({e}); run python3 tools/build-stills.py")
        return 1
    items = inputs()
    now = dict(items)
    if man.get("inputs") != input_hash(items):
        was = dict(man.get("inputList", []))
        changed = sorted(k for k in set(now) | set(was) if now.get(k) != was.get(k))
        problems.append("the generating inputs changed: " + (", ".join(changed) if changed else "(no per-file list in the manifest)"))
    total = 0
    for pl in PLACES:
        for d in DENSITIES:
            f = out_name(pl, d)
            p = os.path.join(OUT_DIR, f)
            if not os.path.exists(p):
                problems.append(f"missing: {rel(p)}")
                continue
            data = open(p, "rb").read()
            total += len(data)
            if man.get("files", {}).get(f, {}).get("sha256") != sha(data):
                problems.append(f"{rel(p)} differs from the manifest (edited by hand?)")
            if len(data) > CAP_FILE:
                problems.append(f"{rel(p)} is {len(data)} bytes (cap {CAP_FILE})")
    if total > CAP_TOTAL:
        problems.append(f"the stills weigh {total} bytes together (cap {CAP_TOTAL})")
    problems += consistency()
    if problems:
        for p in problems:
            print("STALE:", p)
        print("stills: STALE; regenerate with python3 tools/build-stills.py (the demo server must be up)")
        return 1
    print(f"stills: up to date ({len(PLACES) * len(DENSITIES)} files, {total} bytes; inputs {man['inputs'][:12]})")
    return 0


# ------------------------------------------------------------------------------------------------ build
def crop_px(rect, fr, box):
    """World rect -> [x, y, w, h] in viewport CSS px, through the strip's framing; None if it leaves the window."""
    u0, u1, y0, y1 = rect
    s, left, top = fr["scale"], fr["worldLeft"], fr["worldTop"]
    hs = 1.6                                   # scene heights per stretch (compose.js HS)
    x0, x1 = (u0 - left) * s, (u1 - left) * s
    t0, t1 = (top - y1) * s / hs, (top - y0) * s / hs
    eps = 1.0
    if x0 < -eps or t0 < -eps or x1 > box[2] + eps or t1 > box[3] + eps:
        return None
    x0, t0 = max(0.0, x0), max(0.0, t0)
    x1, t1 = min(box[2], x1), min(box[3], t1)
    return [box[0] + x0, box[1] + t0, x1 - x0, t1 - t0]


def window_of(fr, box):
    s, left, top = fr["scale"], fr["worldLeft"], fr["worldTop"]
    return [round(left, 3), round(left + box[2] / s, 3), round(top - box[3] * 1.6 / s, 3), round(top, 3)]


def build(a):
    for pl in PLACES:
        u0, u1, y0, y1 = pl["rect"]
        aspect = (u1 - u0) * 1.6 / (y1 - y0)
        if abs(aspect / (pl["w"] / TILE_H) - 1) > 0.002:
            sys.exit(f"crop table: {pl['name']} has aspect {aspect:.4f}, its tile {pl['w'] / TILE_H:.4f}")
    names = q.split(a.places, [p["name"] for p in PLACES]) if a.places else [p["name"] for p in PLACES]
    if a.preview:
        if q.inside_repo(a.preview):
            sys.exit(f"--preview must be outside the repo: {a.preview}")
        os.makedirs(a.preview, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    try:
        man = json.load(open(MANIFEST))
    except (OSError, ValueError):
        man = {}
    files = dict(man.get("files", {}))
    report = []
    with q.session() as pg:
        for pl in [p for p in PLACES if p["name"] in names]:
            t0 = time.time()
            pg.open(q.url(a.base, pl["page"]), VIEWPORT, settle=True, timeout=a.timeout)
            pg.add_style(HIDE_CSS, "stills-hide")
            mode = pg.ev(REMOUNT_JS + f"({ENGINE_QUALITY}, {json.dumps(PALETTE)})")
            if mode != "webgl":
                sys.exit(f"{pl['name']}: the engine mounted as {mode!r}, not webgl; the stills need the WebGL painting")
            pg.run.step({"wait_for": SETTLE_JS, "timeout": a.timeout, "required": True})
            pg.frames(12)                      # let any late fade or upload land, then settle again
            pg.run.step({"wait_for": SETTLE_JS, "timeout": a.timeout, "required": True})
            st = pg.ev("window.__stillsHandle.stats()")
            if st.get("figures", {}).get(str(pl["stretch"])) not in ("ready", "none"):
                sys.exit(f"{pl['name']}: figure layer {st.get('figures')}")
            if int(st.get("stretch", -1)) != pl["stretch"]:
                sys.exit(f"{pl['name']}: the page sits at stretch {st.get('stretch')}, the table says {pl['stretch']}")
            box = pg.ev(BOX_JS)
            fr = (st.get("framing") or {}).get("strip")
            if not box or not fr:
                sys.exit(f"{pl['name']}: no strip window on {pl['page']}")
            clip = crop_px(pl["rect"], fr, box)
            if clip is None:
                sys.exit(f"{pl['name']}: crop {pl['rect']} leaves the strip window {window_of(fr, box)} "
                         f"(u0, u1, y0, y1); re-aim the crop table")
            png = cdp.capture(pg.tab, clip=clip, fast=False)
            if a.preview:
                open(os.path.join(a.preview, f"{pl['name']}-crop.png"), "wb").write(png)
            sizes = [[d, pl["w"] * d, TILE_H * d] for d in DENSITIES]
            res = pg.ev(PROCESS_JS + f"({json.dumps(base64.b64encode(png).decode())}, {json.dumps(sizes)}, "
                        f"{json.dumps(list(PAPER))}, {WEBP_Q})")
            if res.get("error"):
                sys.exit(f"{pl['name']}: {res['error']}")
            errs = pg.errors()
            if errs:
                print(f"  {pl['name']}: console errors:\n    " + "\n    ".join(errs))
            for d in DENSITIES:
                data = plain_webp(base64.b64decode(res[str(d)]))
                f = out_name(pl, d)
                open(os.path.join(OUT_DIR, f), "wb").write(data)
                files[f] = {"bytes": len(data), "sha256": sha(data), "size": [pl["w"] * d, TILE_H * d]}
                if a.preview:
                    open(os.path.join(a.preview, f), "wb").write(data)
            report.append({"place": pl["name"], "src": "x".join(map(str, res["src"])),
                           "1x": files[out_name(pl, 1)]["bytes"], "2x": files[out_name(pl, 2)]["bytes"],
                           "paper": res.get("paper2"), "window": " ".join(map(str, window_of(fr, box))),
                           "quality": st.get("quality"), "s": round(time.time() - t0, 1)})
    items = inputs()
    whole = set(names) == {p["name"] for p in PLACES}
    if not whole and man.get("inputs") not in (None, input_hash(items)):
        # a partial run cannot vouch for the places it skipped: keep the old inputs, so --check still says stale
        print("note: only " + ", ".join(names) + " rebuilt and the inputs changed; run without --places to refresh all")
        items = sorted(dict(man.get("inputList", {})).items())
        digest = man["inputs"]
    else:
        digest = input_hash(items)
    total = sum(v["bytes"] for v in files.values())
    json.dump({
        "about": "Footer story-map stills, made by tools/build-stills.py from the engine; regenerate after any engine "
                 "or scene change. inputs = sha256 over inputList.",
        "inputs": digest,
        "inputList": dict(items),
        "tiles": {p["name"]: [p["w"], TILE_H] for p in PLACES},
        "files": dict(sorted(files.items())),
        "totalBytes": total,
    }, open(MANIFEST, "w"), indent=1)
    open(MANIFEST, "a").write("\n")
    q.table(report, [("place", "place"), ("src", "capture px"), ("1x", "1x bytes"), ("2x", "2x bytes"),
                     ("paper", "paper share @2x"), ("window", "strip window u0 u1 y0 y1"),
                     ("quality", "engine q"), ("s", "s")], title=f"Stills ({TILE_H} px tall @1x)")
    print(f"\n{len(files)} files, {total} bytes in {rel(OUT_DIR)}/ (cap {CAP_TOTAL}); manifest {rel(MANIFEST)}")
    bad = consistency()
    for b in bad:
        print("note:", b)
    if total > CAP_TOTAL or any(v["bytes"] > CAP_FILE for v in files.values()):
        print("over the size caps: lower WEBP_Q or the tile")
        return 1
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default=q.BASE, help="demo server root (default %(default)s)")
    ap.add_argument("--places", default="", help="comma list of: " + ",".join(p["name"] for p in PLACES) + " (default all)")
    ap.add_argument("--preview", metavar="DIR", help="also write the raw crops and the stills here (outside the repo)")
    ap.add_argument("--timeout", type=int, default=90000, help="settle timeout per page, ms (default %(default)s)")
    ap.add_argument("--check", action="store_true", help="no browser: exit 1 when the stills are stale")
    a = ap.parse_args()
    return check() if a.check else build(a)


if __name__ == "__main__":
    sys.exit(main())

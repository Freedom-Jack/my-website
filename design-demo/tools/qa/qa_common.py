#!/usr/bin/env python3
"""Shared plumbing for the demo-4b QA probes (stdlib only; imported by budget.py, gaps.py, contrast.py, drift.py,
frames.py, places.py, router.py). Not a tool by itself.

- Runs one headless Chrome through cdp.py (Chrome, Runner) and offers a small Page wrapper: open(), ev(), settle(),
  scroll_to(), png() and console errors.
- settle(): waits on the landscape's stats() (cdp.SETTLE_JS), never on a fixed delay; fixed waits catch the
  painting mid-bloom when other Chromes compete for the CPU (_notes/r4b/RECORD.md section 8.3).
- Viewport presets: the three budget sizes and the README QA matrix.
- A stdlib PNG decoder (fast path for Chrome's speed-optimised PNGs, whose rows all use the Up filter) and colour
  maths: sRGB -> relative luminance (WCAG), WCAG contrast, CIELAB chroma C*.
- Output: tables on stdout; JSON only where --json asks; images only outside the repo (out_dir() refuses the repo).

Every tool takes --base (default http://localhost:4173), so it can measure a prototype copy served on another port.
"""
import argparse, json, math, os, struct, sys, tempfile, time, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cdp  # noqa: E402  (the driver lives next to this file)

DEMO = os.path.dirname(os.path.dirname(HERE))          # design-demo/
REPO = os.path.dirname(DEMO)                           # my-website/
BASE = "http://localhost:4173"

# The pages, in story order. "short" = the §6 accepted exception for short pages (display ratio over .10 on wide
# screens; whole content on screen one reports a low word count).
PAGES = {
    "home": "/",
    "work": "/work/",
    "resume": "/resume/",
    "contact": "/contact/",
    "writing": "/writing/",
    "note": "/writing/what-is-an-ai-agent/",
    "404": "/no-such-place/",
}
SHORT_PAGES = {"contact", "writing", "note", "404"}
PLACES = ["home", "work", "writing", "resume", "contact", "404"]    # the six places (the Note shares Writing's)

# name: [width, height, dpr, mobile]
VIEWPORTS = {
    "1440": [1440, 900, 1, False],
    "1280": [1280, 720, 1, False],
    "1024": [1024, 768, 1, False],
    "768": [768, 1024, 2, True],
    "390": [390, 844, 3, True],
    "375": [375, 667, 3, True],
    "360": [360, 800, 3, True],
    "339": [339, 720, 3, True],
    "320": [320, 640, 3, True],
    "844x390": [844, 390, 3, True],
}
BUDGET_VPS = ["1440", "1280", "390"]
MATRIX_VPS = ["320", "339", "360", "375", "390", "768", "844x390", "1024", "1280", "1440"]


# ------------------------------------------------------------------------------------------------ arguments / output
def parser(desc, pages=None, vps=None):
    ap = argparse.ArgumentParser(description=desc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default=BASE, help="server root (default %(default)s); e.g. a prototype copy's port")
    ap.add_argument("--json", metavar="PATH", help="also write the full results as JSON to PATH (outside the repo)")
    if pages is not None:
        ap.add_argument("--pages", default=",".join(pages), help="comma list of: " + ",".join(PAGES) + " (default %(default)s)")
    if vps is not None:
        ap.add_argument("--vps", default=",".join(vps), help="comma list of: " + ",".join(VIEWPORTS) + " (default %(default)s)")
    ap.add_argument("--query", default="", help="extra query string for every page, e.g. palette=rich")
    ap.add_argument("--timeout", type=int, default=60000, help="settle timeout per page, ms (default %(default)s; under heavy CPU load a page can take 25 s)")
    return ap


def split(s, known=None):
    out = [x.strip() for x in s.split(",") if x.strip()]
    if known is not None:
        bad = [x for x in out if x not in known]
        if bad:
            sys.exit(f"unknown: {', '.join(bad)} (known: {', '.join(known)})")
    return out


def url(base, page, query=""):
    u = base.rstrip("/") + PAGES.get(page, page)
    return u + (("&" if "?" in u else "?") + query.lstrip("?&") if query else "")


def inside_repo(path):
    p = os.path.realpath(path)
    return p == os.path.realpath(REPO) or p.startswith(os.path.realpath(REPO) + os.sep)


def out_dir(sub=""):
    """Where images and sheets go: $QA_OUT (set it to the session scratchpad's qa/), else <tmp>/design-demo-qa.
    Never inside the repo (DESIGN §1: research screenshots are never committed)."""
    root = os.environ.get("QA_OUT") or os.path.join(tempfile.gettempdir(), "design-demo-qa")
    d = os.path.join(root, sub) if sub else root
    if inside_repo(d):
        sys.exit(f"refusing to write into the repo: {d} (set QA_OUT to the scratchpad)")
    os.makedirs(d, exist_ok=True)
    return d


def save_json(path, obj):
    if not path:
        return
    if inside_repo(path):
        sys.exit(f"refusing to write JSON into the repo: {path}")
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
    print(f"[json] {path}")


def table(rows, cols, title=None):
    """rows: list of dicts; cols: list of (key, header). Prints a compact fixed-width table."""
    if title:
        print(f"\n{title}")
    if not rows:
        print("  (no rows)")
        return
    cells = [[("" if r.get(k) is None else str(r.get(k))) for k, _ in cols] for r in rows]
    w = [max(len(h), *(len(c[i]) for c in cells)) for i, (_, h) in enumerate(cols)]
    print("  " + "  ".join(h.ljust(w[i]) for i, (_, h) in enumerate(cols)))
    print("  " + "  ".join("-" * w[i] for i in range(len(cols))))
    for c in cells:
        print("  " + "  ".join(c[i].ljust(w[i]) for i in range(len(cols))))


def fmt(v, d=2):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.{d}f}"
    return str(v)


# ------------------------------------------------------------------------------------------------ browser
# Hide the page's glyphs but keep every background, border, veil and the canvas: the "real background" of a line.
# Link underlines and brush marks are the text's own decoration, so they go too; the seal is a graphic.
# (Transitions are switched off first, by NO_TRANSITIONS_CSS, or the hidden colours would fade instead of switching.)
NO_TRANSITIONS_CSS = "*, *::before, *::after { transition: none !important; }"
HIDE_GLYPHS_CSS = """
*, *::before, *::after { transition: none !important; color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; }
a, a *, button *, .brush, .next__to, .ink-btn__label, .ink-btn__arrow, [data-qa-clip], [data-qa-clip] *,
summary.case__summary::after { background-image: none !important; }
svg text, svg tspan { fill: transparent !important; stroke: transparent !important; }
"""
# The 4a "hidden" sheets: main invisible except the art boxes (veils stay bound: the engine reads layout only).
HIDE_MAIN_CSS = """
main { visibility: hidden !important; }
main .strip__art, main .closing__art { visibility: visible !important; }
"""


# Every visible text line box on screen (viewport CSS px), page-wide (main, header, footer), with its colour:
# HTML text uses `color`; SVG text `fill` (scaled by the SVG's CTM); text painted through background-clip:text with
# a transparent colour (the ink button's label) uses --ink-1, its resting ink. Ancestor opacity multiplies alpha.
# Lines under a fixed or sticky overlay (the returning header, the Note's reading-progress line, the demo's compare
# panel) are skipped: they are covered or scrolling under it, not shown. Glyphs painted through background-clip:text
# are tagged data-qa-clip so HIDE_GLYPHS_CSS can remove them too.
LINES_JS = r"""(() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const overlays = [];
  for (const e of document.body.querySelectorAll('*')) {
    const p = getComputedStyle(e).position;
    if ((p !== 'fixed' && p !== 'sticky') || e.matches('canvas, .skip-link')) continue;
    const b = e.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw) continue;
    overlays.push({ e, b });
  }
  const tmp = document.createElement('span'); tmp.style.display = 'none'; document.body.append(tmp);
  const resolve = (v) => { tmp.style.color = v; return getComputedStyle(tmp).color; };
  const opac = (el) => { let a = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity); return a; };
  const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const label = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 2); if (c.length) s += '.' + c.join('.'); return s; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let n;
  while ((n = tw.nextNode())) {
    const t = n.nodeValue;
    if (!t || !/\S/.test(t)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, template, .seal, .visually-hidden, .sr-only, canvas')) continue;
    if (el.classList.contains('seal__glyph')) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    let fs = parseFloat(cs.fontSize), color = cs.color, kind = 'text';
    if (el instanceof SVGElement) {
      kind = 'svg';
      color = cs.fill && cs.fill.startsWith('rgb') ? cs.fill : color;
      const svg = el.ownerSVGElement; const m = svg && svg.getScreenCTM && svg.getScreenCTM();
      if (m) fs = fs * Math.hypot(m.a, m.b);
    } else {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') { color = resolve('var(--ink-1)'); kind = 'clip'; e.setAttribute('data-qa-clip', ''); break; }
      }
    }
    const a = opac(el);
    const where = el.closest('.site-header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('main') ? 'main' : 'other';
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      if (overlays.some((o) => !o.e.contains(el) && r.right > o.b.left && r.left < o.b.right && r.bottom > o.b.top && r.top < o.b.bottom)) continue;
      out.push({ x: r.left, y: r.top, w: r.width, h: r.height, fs: Math.round(fs * 10) / 10, fw: cs.fontWeight,
        color, alpha: a, kind, where, el: label(el), text: t.trim().replace(/\s+/g, ' ').slice(0, 40) });
    }
  }
  tmp.remove();
  return out;
})()"""


class Page:
    """One tab: open(url, vp) -> settle -> measure. Use inside `with session() as pg:`."""

    def __init__(self, chrome):
        self.chrome, self.tab = chrome, chrome.tab
        self.run = cdp.Runner(self.tab, verbose=False)
        self.vp = None
        self._reduced = None

    # -- navigation
    def open(self, address, vp="1440", reduced=False, settle=True, timeout=30000):
        v = VIEWPORTS[vp] if isinstance(vp, str) else vp
        self.vp = list(v)
        self.run.step({"viewport": list(v)})
        if reduced != self._reduced:
            self.run.step({"reduced_motion": bool(reduced)})
            self._reduced = reduced
        self.run.step({"goto": "about:blank"})
        cdp.drain_console(self.tab)
        self.run.step({"goto": address})
        self.park()
        return self.settle(timeout) if settle else None

    def settle(self, timeout=30000):
        t0 = time.time()
        r = self.run.step({"settle": timeout})
        return {"state": r or "timeout", "ms": round((time.time() - t0) * 1000)}

    # -- JS
    def ev(self, expr, default=None):
        val, err = cdp.evaluate(self.tab, expr)
        if err:
            raise RuntimeError(f"JS error: {err[:600]}")
        return default if val is None else val

    def stats(self):
        return self.ev("""(async()=>{try{const m=await import('/assets/js/main.js');const L=m.site&&m.site.landscape;
          return L&&L.stats?L.stats():null}catch(e){return null}})()""")

    def call_js_file(self, name, opts=None):
        src = open(os.path.join(HERE, name)).read().strip().rstrip(";")
        return self.ev(f"({src})({json.dumps(opts or {})})")

    # -- input
    def park(self, x=10, y=10):
        """Move the pointer to a spot away from the art (the header's left corner) so the wake stays shut."""
        self.tab.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y)
        self.run.mouse = [x, y]

    def scroll_to(self, y, settle=True, timeout=30000):
        self.run.step({"scroll": int(y)})
        return self.settle(timeout) if settle else None

    def add_style(self, css, sid="qa-style"):
        self.ev(f"""(()=>{{let s=document.getElementById({json.dumps(sid)});if(!s){{s=document.createElement('style');
          s.id={json.dumps(sid)};document.head.append(s)}}s.textContent={json.dumps(css)};return 1}})()""")

    def remove_style(self, sid="qa-style"):
        self.ev(f"(()=>{{const s=document.getElementById({json.dumps(sid)});if(s)s.remove();return 1}})()")

    def frames(self, n=2):
        self.ev("new Promise(r=>{let k=%d;const f=()=>{if(--k<=0)r(1);else requestAnimationFrame(f)};requestAnimationFrame(f)})" % n)

    # -- pixels
    def png(self, clip=None):
        return cdp.capture(self.tab, clip=clip, fast=True)

    def image(self, clip=None):
        return Image.decode(self.png(clip))

    # -- console
    def console(self):
        return cdp.drain_console(self.tab)

    def errors(self, ignore_404_doc=True):
        out = []
        for l in self.console():
            if "GPU stall due to ReadPixels" in l:
                continue
            if not ("EXCEPTION" in l or "console.error" in l or "log.error" in l):
                continue
            if ignore_404_doc and "status of 404" in l and "/no-such-place" in l:
                continue   # the designed 404 page is served with status 404, as it should be
            out.append(l)
        return out


class session:
    """with session() as pg: ...   (one headless Chrome; extra flags from $CDP_ARGS or args)."""

    def __init__(self, args=None):
        self.chrome = cdp.Chrome(args=args)

    def __enter__(self):
        self.chrome.__enter__()
        return Page(self.chrome)

    def __exit__(self, *exc):
        return self.chrome.__exit__(*exc)


# ------------------------------------------------------------------------------------------------ PNG + colour
_M7 = {}


def _up(raw, prev_int, st):
    """PNG 'Up' filter for a whole row at once: byte-wise (raw + prev) mod 256 without carries between bytes."""
    m7 = _M7.get(st)
    if m7 is None:
        m7 = _M7[st] = (int.from_bytes(b"\x7f" * st, "big"), int.from_bytes(b"\x80" * st, "big"))
    a = int.from_bytes(raw, "big")
    s = ((a & m7[0]) + (prev_int & m7[0])) ^ ((a ^ prev_int) & m7[1])
    return s


class Image:
    """Decoded 8-bit RGB/RGBA PNG: w, h, ch, data (bytes, row-major)."""

    def __init__(self, w, h, ch, data):
        self.w, self.h, self.ch, self.data = w, h, ch, data

    @classmethod
    def decode(cls, png):
        assert png[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
        i, idat, w = 8, [], None
        while i < len(png):
            n, t = struct.unpack(">I4s", png[i:i + 8]); c = png[i + 8:i + 8 + n]; i += 12 + n
            if t == b"IHDR":
                w, h, bd, ct, _, _, il = struct.unpack(">IIBBBBB", c[:13])
                if bd != 8 or ct not in (2, 6) or il:
                    raise ValueError(f"unsupported PNG (bit depth {bd}, colour type {ct}, interlace {il})")
            elif t == b"IDAT":
                idat.append(c)
        ch = 3 if ct == 2 else 4
        raw = zlib.decompress(b"".join(idat))
        st = w * ch
        out = bytearray(h * st)
        prev = bytes(st); prev_int = 0
        p = 0
        for y in range(h):
            f = raw[p]; line = raw[p + 1:p + 1 + st]; p += 1 + st
            if f == 0:
                cur = bytes(line)
                prev_int = None
            elif f == 2:
                if prev_int is None:
                    prev_int = int.from_bytes(prev, "big")
                prev_int = _up(line, prev_int, st)
                cur = prev_int.to_bytes(st, "big")
            else:
                ln = bytearray(line)
                if f == 1:
                    for x in range(ch, st):
                        ln[x] = (ln[x] + ln[x - ch]) & 255
                elif f == 3:
                    for x in range(st):
                        ln[x] = (ln[x] + ((ln[x - ch] if x >= ch else 0) + prev[x]) // 2) & 255
                elif f == 4:
                    for x in range(st):
                        a = ln[x - ch] if x >= ch else 0; b = prev[x]; c = prev[x - ch] if x >= ch else 0
                        pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                        ln[x] = (ln[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
                cur = bytes(ln)
                prev_int = None
            out[y * st:(y + 1) * st] = cur
            prev = cur
        return cls(w, h, ch, bytes(out))

    def pixels(self, x0, y0, x1, y1, step=1):
        """Yield (r, g, b) over the device-pixel box [x0, x1) x [y0, y1), every `step` pixels."""
        x0, y0 = max(0, int(x0)), max(0, int(y0))
        x1, y1 = min(self.w, int(math.ceil(x1))), min(self.h, int(math.ceil(y1)))
        if x1 <= x0 or y1 <= y0:
            return
        ch, st, d = self.ch, self.w * self.ch, self.data
        for y in range(y0, y1, step):
            row = y * st
            a, b = row + x0 * ch, row + x1 * ch
            yield from zip(d[a:b:ch * step], d[a + 1:b:ch * step], d[a + 2:b:ch * step])

    def crop(self, x0, y0, x1, y1):
        """A new Image of the device-pixel box (clamped)."""
        x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(self.w, int(x1)), min(self.h, int(y1))
        st, ch = self.w * self.ch, self.ch
        rows = b"".join(self.data[y * st + x0 * ch:y * st + x1 * ch] for y in range(y0, y1))
        return Image(x1 - x0, y1 - y0, ch, rows)

    def to_png(self):
        """Encode (filter 0, zlib level 6): enough for sheets and tiles, no PIL needed."""
        st = self.w * self.ch
        raw = b"".join(b"\x00" + self.data[y * st:(y + 1) * st] for y in range(self.h))
        def chunk(t, c):
            return struct.pack(">I", len(c)) + t + c + struct.pack(">I", zlib.crc32(t + c) & 0xFFFFFFFF)
        ihdr = struct.pack(">IIBBBBB", self.w, self.h, 8, 2 if self.ch == 3 else 6, 0, 0, 0)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")

    def crop_rgb(self, x0, y0, x1, y1):
        """RGB bytes of a box (for diffs)."""
        out = bytearray()
        st, ch = self.w * self.ch, self.ch
        for y in range(max(0, y0), min(self.h, y1)):
            row = self.data[y * st + x0 * ch:y * st + x1 * ch]
            if ch == 3:
                out += row
            else:
                out += bytes(v for i, v in enumerate(row) if i % 4 != 3)
        return bytes(out)


_LIN = [((v / 255) / 12.92) if v / 255 <= 0.04045 else (((v / 255) + 0.055) / 1.055) ** 2.4 for v in range(256)]


def luminance(r, g, b):
    return 0.2126 * _LIN[r] + 0.7152 * _LIN[g] + 0.0722 * _LIN[b]


def contrast(l1, l2):
    hi, lo = (l1, l2) if l1 >= l2 else (l2, l1)
    return (hi + 0.05) / (lo + 0.05)


_LAB = {}


def _f(t):
    return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116


def lab(r, g, b):
    key = (r << 16) | (g << 8) | b
    v = _LAB.get(key)
    if v is None:
        R, G, B = _LIN[r], _LIN[g], _LIN[b]
        X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
        Y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B)
        Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883
        fx, fy, fz = _f(X), _f(Y), _f(Z)
        L, a, bb = 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
        v = _LAB[key] = (L, a, bb, math.hypot(a, bb))
    return v


def chroma(r, g, b):
    return lab(r, g, b)[3]


def parse_css_color(s):
    """'rgb(1, 2, 3)' / 'rgba(1, 2, 3, .5)' / 'color(srgb r g b / a)' -> (r, g, b, a) with r,g,b in 0..255."""
    s = s.strip()
    if s.startswith("color(srgb"):
        body = s[len("color(srgb"):].rstrip(")").replace("/", " ").split()
        r, g, b = (round(float(x) * 255) for x in body[:3])
        a = float(body[3]) if len(body) > 3 else 1.0
        return r, g, b, a
    if s.startswith("rgb"):
        body = s[s.index("(") + 1:s.rindex(")")].replace("/", ",").replace(" ", ",")
        parts = [p for p in body.split(",") if p]
        r, g, b = (round(float(p)) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return r, g, b, a
    raise ValueError(f"colour not parsed: {s}")


def percentile(sorted_vals, q):
    if not sorted_vals:
        return None
    k = min(len(sorted_vals) - 1, max(0, int(round(q * (len(sorted_vals) - 1)))))
    return sorted_vals[k]


def hist_stats(hist, total):
    """hist: list[256] of counts of |delta| values -> (mean, p99, max)."""
    if not total:
        return 0.0, 0, 0
    s = sum(i * c for i, c in enumerate(hist))
    mx = max((i for i, c in enumerate(hist) if c), default=0)
    acc, p99 = 0, 0
    for i, c in enumerate(hist):
        acc += c
        if acc >= 0.99 * total:
            p99 = i
            break
    return s / total, p99, mx

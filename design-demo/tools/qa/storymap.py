#!/usr/bin/env python3
"""storymap.py: the footer story map, measured (DESIGN 5 footer, 11.B; record: _notes/r4b/RECORD.md section 5.1).

    python3 tools/qa/storymap.py                                   # 7 pages x the README matrix, 16 px default font
    python3 tools/qa/storymap.py --pages home --vps 1440,390 --shots
    python3 tools/qa/storymap.py --pages contact --vps 320,360,390 --fonts 16,20,24      # enlarged text (WCAG 1.4.4)

Per page x viewport x default font size (Chrome's own setting, CDP Page.setFontSizes), after a stats() settle, with
the map scrolled to the middle of the screen and its stills decoded:
- geometry: each scene's focus, its tick and its label centre within 1 px; the tall tick exactly where the label has
  aria-current; every label >= 44 x 44, on screen, not overlapping another, the topmost thing at its own centre;
  label text >= 8 px apart within a row; no sideways scroll; one label row unless the map has fallen back to its
  wrapping row (large text);
- the windows: every scene's soft window (.story-map__scene, slant included) lies inside its still, so no still's
  own edge ever shows;
- one painting: the darkness profile across the art (paper minus each CSS column's mean luminance over the art's
  rows, paper read in the art -> labels gap). Between Home's and Contact's labels no run of 8 or more columns
  outside the road may be paper (< 1.5/255): neighbours meet in mist (a seam may cross a few columns of pale mist,
  as between the pavilion's promontory and the terraces' foot). The road (between Work's and Writing's labels) is reported: its paper
  run (phones: 12-20 px is the brief's breath) and its low-ink band (< 5/255; wide: about half a column);
- the figures' clearance (DESIGN 4.6, nothing figurative within 40 px of text): for each place, from the lowest row
  of dark ink (luminance < 170) in the still it shows, to the top of its label's text. Conservative: the terraces'
  dikes count as figures.
Exit 1 on any problem. --shots keeps a picture of each map in $QA_OUT/storymap/ (never the repo).
"""
import os
import sys
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q   # noqa: E402
import cdp              # noqa: E402

SLANT = 0.182          # layout.css: a 20deg feather reaches h/2 * tan 20 past the window's middle row
PAPER_RUN, LOW_INK = 1.5, 5.0
HOLE_MIN = 8           # px: a seam may cross a few columns of pale mist (the lake's edge); a hole is wider
CLEARANCE = 40

MEASURE = r"""(async () => {
  const sm = document.querySelector('.story-map');
  if (!sm) return {err: 'no story map'};
  sm.scrollIntoView({block: 'center'});
  const imgs = [...sm.querySelectorAll('.story-map__scene img')];
  for (const i of imgs) { i.loading = 'eager'; try { await i.decode(); } catch (e) { /* counted below */ } }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const R = (b) => [+b.left.toFixed(1), +b.top.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)];
  const art = sm.querySelector('.story-map__art'), ab = art.getBoundingClientRect(), H = ab.height;
  const out = {vw: innerWidth, sw: document.documentElement.scrollWidth, art: R(ab), H, labels: [], ticks: [], scenes: [], probs: [],
    mode: getComputedStyle(sm.querySelector('.story-map__list')).display,
    columns: getComputedStyle(sm).justifyContent !== 'space-between'};   // the six equal columns (not the labels' own)
  const labs = {};
  for (const a of sm.querySelectorAll('.story-map__list a')) {
    const s = a.closest('li').dataset.stretch, b = a.getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(a); const t = r.getBoundingClientRect();
    const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    labs[s] = {s, c: b.left + b.width / 2, box: R(b), text: R(t), cur: a.getAttribute('aria-current'), self: at === a || a.contains(at)};
    out.labels.push(labs[s]);
  }
  for (const t of sm.querySelectorAll('.story-map__tick')) { const b = t.getBoundingClientRect(); out.ticks.push({s: t.dataset.stretch, c: b.left + b.width / 2, tall: b.height > 10}); }
  for (const sp of sm.querySelectorAll('.story-map__scene')) {
    const img = sp.querySelector('img'), sb = sp.getBoundingClientRect(), ib = img.getBoundingClientRect(), cs = getComputedStyle(sp);
    const s = sp.dataset.stretch, f = parseFloat(cs.getPropertyValue('--focus')) / 100;
    const sl = cs.getPropertyValue('--tl').trim() === '90deg' ? 0 : %(slant)s * H, sr = cs.getPropertyValue('--tr').trim() === '90deg' ? 0 : %(slant)s * H;
    const e = {s, ok: img.complete && img.naturalWidth > 0, src: (img.currentSrc || '').split('/').pop(), win: [+sb.left.toFixed(1), +sb.right.toFixed(1)],
      img: [+ib.left.toFixed(1), +ib.right.toFixed(1)], focus: +(ib.left + f * ib.width).toFixed(1),
      inL: +(sb.left - sl - ib.left).toFixed(1), inR: +(ib.right - sb.right - sr).toFixed(1), masked: cs.maskImage !== 'none' || cs.webkitMaskImage !== 'none'};
    // the lowest row of dark ink in the still itself (its 2x file, whatever the screen picked)
    if (e.ok) {
      const src2 = img.currentSrc.replace('@1x.', '@2x.');
      const im = new Image(); im.src = src2;
      try { await im.decode(); } catch (err) { /* reported as null */ }
      if (im.naturalWidth) {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let low = null;
        for (let y = c.height - 1; y >= 0 && low === null; y--) for (let i = 0; i < c.width; i++) {
          const k = (y * c.width + i) * 4;
          if (.2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2] < 170) { low = (c.height - 1 - y) / c.height; break; }
        }
        e.lowInk = low;
      }
    }
    out.scenes.push(e);
    if (!e.ok) out.probs.push(`scene ${s} not loaded`);
    if (!e.masked) out.probs.push(`scene ${s} has no mask`);
    if (e.inL < -0.5) out.probs.push(`scene ${s}: its window leaves the still by ${-e.inL} px on the left`);
    if (e.inR < -0.5) out.probs.push(`scene ${s}: its window leaves the still by ${-e.inR} px on the right`);
    const L = labs[s];
    if (out.mode !== 'flex' && L && Math.abs(e.focus - L.c) > 1.01) out.probs.push(`scene ${s}: focus ${e.focus} vs label ${L.c.toFixed(1)}`);
    if (L && e.lowInk != null) {
      L.clearance = +(L.text[1] - (ab.bottom - e.lowInk * H)).toFixed(1);
      if (L.clearance < %(clear)s) out.probs.push(`scene ${s}: figures ${L.clearance} px from its label's text (< %(clear)s)`);
    }
  }
  for (const t of out.ticks) { const L = labs[t.s]; if (out.mode !== 'flex' && L && Math.abs(t.c - L.c) > 1.01) out.probs.push(`tick ${t.s} off its label by ${(t.c - L.c).toFixed(1)}`); }
  const tall = out.ticks.filter((t) => t.tall).map((t) => t.s).join(), cur = out.labels.filter((l) => l.cur).map((l) => l.s).join();
  if (tall !== cur) out.probs.push(`tall tick [${tall}] vs aria-current [${cur}]`);
  if (out.sw > innerWidth) out.probs.push(`sideways scroll ${out.sw} > ${innerWidth}`);
  const ls = out.labels;
  for (const l of ls) {
    if (l.box[2] < 44 || l.box[3] < 44) out.probs.push(`label ${l.s} is ${l.box[2]} x ${l.box[3]}`);
    if (l.box[0] < -0.5 || l.box[0] + l.box[2] > innerWidth + 0.5) out.probs.push(`label ${l.s} leaves the screen`);
    if (!l.self) out.probs.push(`label ${l.s} is covered at its centre`);
  }
  out.rows = new Set(ls.map((l) => Math.round(l.box[1]))).size;
  out.gaps = [];
  for (let i = 1; i < ls.length; i++) {
    const A = ls[i - 1], B = ls[i];
    if (Math.round(A.box[1]) !== Math.round(B.box[1])) continue;
    if (B.box[0] < A.box[0] + A.box[2] - 0.5) out.probs.push(`labels ${A.s} and ${B.s} overlap`);
    out.gaps.push(+(B.text[0] - (A.text[0] + A.text[2])).toFixed(1));
  }
  if (out.gaps.some((g) => g < 7.5)) out.probs.push('label text closer than 8 px: ' + out.gaps.join(' / '));
  if (out.rows > 1 && out.mode !== 'flex') out.probs.push(`${out.rows} label rows outside the wrapping fallback`);
  out.textTop = Math.min(...ls.map((l) => l.text[1]));
  out.centres = Object.fromEntries(ls.map((l) => [l.s, l.c]));
  return out;
})()""".replace("%(slant)s", str(SLANT)).replace("%(clear)s", str(CLEARANCE))


def runs(p, lo, hi, thr, minw=3):
    out, st = [], None
    for x in range(max(0, lo), min(len(p), hi)):
        if p[x] < thr:
            st = x if st is None else st
        else:
            if st is not None and x - st >= minw:
                out.append((st, x))
            st = None
    if st is not None and hi - st >= minw:
        out.append((st, hi))
    return out


def profile(png, m, clip, dpr):
    """Paper minus each CSS column's mean luminance over the art's rows; paper from the art -> labels gap."""
    im = q.Image.decode(png)
    top = m["art"][1] - clip[1]
    y0, y1 = int(top * dpr), int((top + m["art"][3]) * dpr)
    g0, g1 = int((top + m["art"][3] + 4) * dpr), int((m["textTop"] - 4 - clip[1]) * dpr)
    if g1 - g0 < 4:
        g0, g1 = 0, max(2, int(6 * dpr))
    ref = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in im.pixels(0, g0, im.w, g1, 2)]
    pm = sum(ref) / len(ref)
    out = []
    for cx in range(int(m["vw"])):
        px = list(im.pixels(int(cx * dpr), y0, int((cx + 1) * dpr), y1, 1))
        lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
        out.append(pm - sum(lum) / len(lum))
    return out


def main():
    ap = q.parser(__doc__, pages=list(q.PAGES), vps=q.MATRIX_VPS)
    ap.add_argument("--fonts", default="16", help="browser default font sizes in px, comma list (default %(default)s)")
    ap.add_argument("--shots", action="store_true", help="keep each map's picture in $QA_OUT/storymap/")
    a = ap.parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    fonts = [int(f) for f in q.split(a.fonts)]
    shots = q.out_dir("storymap") if a.shots else None
    rows, everything, bad = [], {}, 0
    with q.session() as pg:
        pg.tab.call("Page.enable")
        for fs in fonts:
            pg.tab.call("Page.setFontSizes", fontSizes={"standard": fs, "fixed": 13})
            for p in pages:
                for vp in vps:
                    v = q.VIEWPORTS[vp]
                    st = pg.open(q.url(a.base, p, a.query), vp, timeout=a.timeout)
                    pg.ev(MEASURE)                      # scroll there and decode, then let the painting settle
                    pg.settle(a.timeout)
                    m = pg.ev(MEASURE)
                    if m.get("err"):
                        print(p, vp, fs, m["err"])
                        bad += 1
                        continue
                    clip = [0, max(0.0, m["art"][1] - 26), v[0], m["textTop"] - m["art"][1] + 60]
                    png = cdp.capture(pg.tab, clip=clip, fast=False)
                    if shots:
                        open(os.path.join(shots, f"{p}-{vp}-{fs}.png"), "wb").write(png)
                    prof = profile(png, m, clip, v[2])
                    c = m["centres"]
                    road_p, road_l, col = "", "", None
                    if m["mode"] != "flex" and all(k in c for k in "01345"):
                        lo, hi = int(c["0"]), int(c["5"])
                        r1, r3 = c["1"], c["3"]
                        holes = [r for r in runs(prof, lo, hi, PAPER_RUN, HOLE_MIN) if not (r[0] > r1 and r[1] < r3)]
                        if holes:
                            m["probs"].append("paper between neighbours (not the road): " + ", ".join(f"{x0}-{x1}" for x0, x1 in holes))
                        rp = runs(prof, int(r1), int(r3), PAPER_RUN)
                        rl = runs(prof, int(r1), int(r3), LOW_INK)
                        road_p = max([x1 - x0 for x0, x1 in rp], default=0)
                        road_l = max([x1 - x0 for x0, x1 in rl], default=0)
                        if m["columns"]:
                            col = m["art"][2] / 6
                    clear = [(l["s"], l.get("clearance")) for l in m["labels"] if l.get("clearance") is not None]
                    worst = min(clear, key=lambda t: t[1]) if clear else None
                    m["profile"] = [round(x, 2) for x in prof]
                    m["errors"] = pg.errors()
                    if m["errors"]:
                        m["probs"].append("console: " + " | ".join(m["errors"])[:200])
                    bad += bool(m["probs"])
                    everything[f"{p}@{vp}@{fs}"] = {**m, "settle": st}
                    rows.append({"page": p, "vp": vp, "font": fs, "h": round(m["H"], 1), "mode": m["mode"], "rows": m["rows"],
                                 "gap": min(m["gaps"], default="-"),
                                 "road": f"{road_p} / {road_l}" + (f" ({road_l / col:.2f} col)" if col and road_l else ""),
                                 "clear": f"{worst[1]} ({worst[0]})" if worst else "-",
                                 "ok": "ok" if not m["probs"] else "FAIL: " + "; ".join(m["probs"])})
                    print(f"  {p} {vp} {fs}px: {rows[-1]['ok']}", flush=True)
    q.table(rows, [("page", "page"), ("vp", "vp"), ("font", "font"), ("h", "art h"), ("mode", "labels"), ("rows", "rows"),
                   ("gap", "min text gap"), ("road", "road paper / low ink px"), ("clear", "min clearance (place)"),
                   ("ok", "result")], title="Footer story map")
    q.save_json(a.json, everything)
    print(f"\n{len(rows) - bad} of {len(rows)} ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

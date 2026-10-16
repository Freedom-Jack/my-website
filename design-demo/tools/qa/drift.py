#!/usr/bin/env python3
"""drift.py: how much the mist moves on its own, in open sky vs under the text (DESIGN 11.D, SPEC 15.3 "Mist").

    python3 tools/qa/drift.py                                  # Home and Work at 1440 and 390, 8 s, at the top
    python3 tools/qa/drift.py --pages home --at 0,1.2 --seconds 8 --stops --json $QA_OUT/drift.json
    python3 tools/qa/drift.py --pages home --vps 1440 --idle   # also: the loop sleeps after 45 s without input

At each position: settle; hide the glyphs (as contrast.py does, so "under text" is the background the text sits
on); move the pointer to (10, 10), away from the art and its wake (the move also wakes the ambient drift, as a
reader's input would); screenshot; wait --seconds; screenshot again. Pixel change = |delta| per RGB channel,
in 1/255, sampled once per CSS px, reported as mean / p99 / max over four regions (viewport CSS px):
  sky   - the strip's art box, its upper 60 %, at least 48 px from any text line, image or keep-out block
          (or --sky x0,y0,x1,y1); falls back to "away" when no strip is on screen;
  art   - the whole strip art box on screen;
  away  - everything on screen at least 48 px from any text line or image, below the header;
  text  - under the text line boxes of main (inflated 2 px).
Targets (4b): sky mean about 3-6 /255 ("gently perceptible"; 4a measured 0.35), text mean <= 0.5 /255 (4a's
"text stays still under its veil" was <= 0.33). 4b as built measures sky mean 0.5-1.6, p99 3-6: most open sky is
uniform, so the mean stays low and p99 is the honest measure. The sky verdict below still grades the mean, so it
prints "too faint" on every 4b page: a known, accepted miss (_notes/r4b/RECORD.md 2.3). Engine counters over the interval (stats().frames etc.) are
printed too. --stops checks that nothing moves under reduced motion and Still (frames stop increasing);
--idle waits 50 s without input and checks that the loop sleeps.
"""
import sys, os, time, operator
from collections import Counter
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

GEOM_JS = r"""(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
  const vis = (b) => b && b[3] > 0 && b[1] < innerHeight && b[2] > 0 && b[0] < innerWidth;
  const art = r(document.querySelector('main [data-landscape="strip"]'));
  const keep = [...document.querySelectorAll('main [data-landscape="keepout"]')].map(r).filter(vis);
  const imgs = [...document.querySelectorAll('main img')].map(r).filter(vis);
  const hd = r(document.querySelector('.site-header'));
  return { art: vis(art) ? art : null, keep, imgs, header: hd && hd[3] > 0 ? hd : null };
})()"""


def masks(W, H, lines, geom, sky_override=None, near=48):
    """CSS-px masks (bytearray W*H) for the four regions."""
    def fill(m, x0, y0, x1, y1, v=1):
        x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W, int(x1 + 0.999)), min(H, int(y1 + 0.999))
        if x1 <= x0:
            return
        run = bytes([v]) * (x1 - x0)
        for y in range(y0, y1):
            m[y * W + x0:y * W + x1] = run
    text = bytearray(W * H)
    nearm = bytearray(W * H)
    for ln in lines:
        if ln["where"] != "main":
            continue
        fill(text, ln["x"] - 2, ln["y"] - 2, ln["x"] + ln["w"] + 2, ln["y"] + ln["h"] + 2)
    for ln in lines:
        fill(nearm, ln["x"] - near, ln["y"] - near, ln["x"] + ln["w"] + near, ln["y"] + ln["h"] + near)
    for b in geom["imgs"] + geom["keep"]:
        fill(nearm, b[0] - near, b[1] - near, b[2] + near, b[3] + near)
    if geom["header"]:
        fill(nearm, 0, 0, W, geom["header"][3])
    away = bytearray(1 if v == 0 else 0 for v in nearm)
    art = bytearray(W * H)
    if geom["art"]:
        fill(art, *geom["art"])
    if sky_override:
        sky = bytearray(W * H); fill(sky, *sky_override)
    elif geom["art"]:
        a = geom["art"]
        top = bytearray(W * H); fill(top, a[0], a[1], a[2], a[1] + 0.6 * (a[3] - a[1]))
        sky = bytearray(1 if (t and w) else 0 for t, w in zip(top, away))
    else:
        sky = away
    return {"sky": sky, "art": art, "away": away, "text": text}


def region_diff(A, B, mask, W, H, dpr):
    """|delta| histogram over the mask, one device pixel per CSS px. -> (mean, p99, max, n_px)."""
    hist = Counter()
    ch, st = A.ch, A.w * A.ch
    step = int(round(dpr))
    n = 0
    sub = operator.sub
    for y in range(H):
        row = mask[y * W:(y + 1) * W]
        x = row.find(1)
        if x < 0:
            continue
        dy = int(y * dpr)
        if dy >= A.h:
            break
        base = dy * st
        while x >= 0:
            e = row.find(0, x)
            if e < 0:
                e = W
            a0, a1 = base + int(x * dpr) * ch, base + min(A.w, int(e * dpr)) * ch
            for c in range(3):
                sa, sb = A.data[a0 + c:a1:ch * step], B.data[a0 + c:a1:ch * step]
                hist.update(map(abs, map(sub, sa, sb)))
            n += e - x
            x = row.find(1, e)
    total = sum(hist.values())
    h = [hist.get(i, 0) for i in range(256)]
    mean, p99, mx = q.hist_stats(h, total)
    return round(mean, 3), p99, mx, n


COUNTERS = ("frames", "presents", "scenes", "drafts")


def deltas(s0, s1):
    return {k: (s1 or {}).get(k, 0) - (s0 or {}).get(k, 0) for k in COUNTERS}


def frames_over(pg, seconds):
    s0 = pg.stats() or {}
    time.sleep(seconds)
    s1 = pg.stats() or {}
    return deltas(s0, s1), s1


def main():
    ap = q.parser(__doc__, pages=["home", "work"], vps=["1440", "390"])
    ap.add_argument("--seconds", type=float, default=8.0, help="interval between the two shots (default %(default)s)")
    ap.add_argument("--at", default="0", help="scroll positions in screens, comma list (default %(default)s)")
    ap.add_argument("--sky", help="override the sky region: x0,y0,x1,y1 in viewport CSS px")
    ap.add_argument("--stops", action="store_true", help="also check reduced motion and Still stop the drift")
    ap.add_argument("--idle", action="store_true", help="also check the loop sleeps after 45 s idle (adds ~55 s per page)")
    a = ap.parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    sky_override = [float(v) for v in a.sky.split(",")] if a.sky else None
    res, rows, checks = {"base": a.base, "seconds": a.seconds, "runs": []}, [], []
    with q.session() as pg:
        for vp in vps:
            W, H, dpr = q.VIEWPORTS[vp][0], q.VIEWPORTS[vp][1], q.VIEWPORTS[vp][2]
            for page in pages:
                pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                docH = pg.ev("document.documentElement.scrollHeight")
                pg.add_style(q.NO_TRANSITIONS_CSS, "qa-notrans")
                for at in [float(x) for x in a.at.split(",")]:
                    y = round(min(at * H, max(0, docH - H)))
                    pg.scroll_to(y, timeout=a.timeout)
                    lines = pg.ev(q.LINES_JS) or []
                    geom = pg.ev(GEOM_JS)
                    pg.add_style(q.HIDE_GLYPHS_CSS, "qa-hide")
                    pg.frames(2)
                    pg.park(10, 10)
                    time.sleep(0.3)
                    s0 = pg.stats() or {}
                    A = pg.image()
                    t0 = time.time()
                    time.sleep(max(0.0, a.seconds - 0.05))
                    B = pg.image()
                    dt = time.time() - t0
                    s1 = pg.stats() or {}
                    pg.remove_style("qa-hide")
                    M = masks(W, H, lines, geom, sky_override)
                    reg = {k: region_diff(A, B, M[k], W, H, dpr) for k in ("sky", "art", "away", "text")}
                    d = deltas(s0, s1)
                    run = {"page": page, "vp": vp, "at": at, "y": y, "seconds": round(dt, 2), "geom": geom,
                           "regions": {k: {"mean": v[0], "p99": v[1], "max": v[2], "px": v[3]} for k, v in reg.items()},
                           "counters": d, "ambient": s1.get("ambient"), "drift": s1.get("drift"), "hzK": s1.get("hzK")}
                    res["runs"].append(run)
                    sky, text = reg["sky"], reg["text"]
                    if not sky[3]:
                        verdict_sky = "-"
                    elif not geom["art"] and not sky_override:
                        verdict_sky = "no strip on screen (sky = away)"
                    else:
                        verdict_sky = "perceptible" if 3 <= sky[0] <= 6 else ("too faint" if sky[0] < 3 else "too strong")
                    verdict_text = "-" if not text[3] else ("still" if text[0] <= 0.5 else "MOVES")
                    f = lambda v: f"{v[0]:.2f}/{v[1]}/{v[2]}" if v[3] else "-"
                    rows.append({"page": page, "vp": vp, "at": at, "sky": f(sky), "art": f(reg["art"]), "away": f(reg["away"]),
                                 "text": f(text), "verdict": f"sky {verdict_sky}; text {verdict_text}",
                                 "frames": f"{d['frames']}f {d['presents']}p {d['scenes']}s", "fps": round(d["frames"] / dt, 1) if dt else None,
                                 "amb": s1.get("ambient")})
                    print(f"  {page} {vp} @{at}: sky {f(sky)}  text {f(text)}  frames {d}", flush=True)
                if a.stops:
                    # reduced motion: a still frame
                    pg.open(q.url(a.base, page, a.query), vp, reduced=True, timeout=a.timeout)
                    pg.park(12, 12)
                    time.sleep(1.0)   # let the last post-load frame land before counting
                    d, s = frames_over(pg, 3)
                    checks.append({"page": page, "vp": vp, "check": "reduced motion", "frames": d["frames"], "ambient": s.get("ambient"),
                                   "ok": d["frames"] == 0})
                    # Still the landscape (the footer toggle; sessionStorage 'ink:still')
                    pg.open(q.url(a.base, page, a.query), vp, reduced=False, timeout=a.timeout)
                    pg.ev("(()=>{const b=document.querySelector('.still-toggle');if(b&&!document.documentElement.classList.contains('is-still'))b.click();return document.documentElement.classList.contains('is-still')})()")
                    time.sleep(1.0)
                    pg.park(14, 14)
                    d, s = frames_over(pg, 3)
                    checks.append({"page": page, "vp": vp, "check": "Still", "frames": d["frames"], "ambient": s.get("ambient"),
                                   "ok": d["frames"] == 0})
                    pg.ev("(()=>{try{sessionStorage.removeItem('ink:still')}catch(e){}const b=document.querySelector('.still-toggle');if(b&&document.documentElement.classList.contains('is-still'))b.click();return 1})()")
                if a.idle:
                    pg.open(q.url(a.base, page, a.query), vp, reduced=False, timeout=a.timeout)
                    pg.park(16, 16)
                    time.sleep(50)
                    d, s = frames_over(pg, 3)
                    checks.append({"page": page, "vp": vp, "check": "idle 50 s", "frames": d["frames"], "ambient": s.get("ambient"),
                                   "ok": d["frames"] == 0})
    q.table(rows, [("page", "page"), ("vp", "vp"), ("at", "at scr"), ("sky", "sky mean/p99/max"), ("art", "art"),
                   ("away", "away"), ("text", "text"), ("verdict", "verdict"), ("frames", "engine over the interval"),
                   ("fps", "fps"), ("amb", "ambient")],
            title=f"Mist drift over {a.seconds:g} s, pixel change in 1/255 (targets: sky mean ~3-6, text mean <= 0.5)")
    if checks:
        q.table([{**c, "ok": "ok" if c["ok"] else "MOVES"} for c in checks],
                [("page", "page"), ("vp", "vp"), ("check", "check"), ("frames", "frames in 3 s"), ("ambient", "ambient"), ("ok", "result")],
                title="Stops")
    res["checks"] = checks
    q.save_json(a.json, res)
    bad = any(not c["ok"] for c in checks) or any("MOVES" in r["verdict"] for r in rows)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

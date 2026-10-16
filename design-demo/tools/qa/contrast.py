#!/usr/bin/env python3
"""contrast.py: every text line against the REAL background it sits on (DESIGN 6 contrast row; 4b's key probe).

    python3 tools/qa/contrast.py                                  # 7 pages x 1440 / 390, the default positions
    python3 tools/qa/contrast.py --pages home,work --positions 0,0.25,0.5,1,1.5,2 --query palette=rich
    python3 tools/qa/contrast.py --shots --json $QA_OUT/contrast.json    # also keep the text-hidden screenshots

Method, at each scroll position (in screens; default 0, .25, .5, .75, 1, 1.5, then every screen to the end, so the
strip -> background handover is sampled densely):
 1. scroll there and wait until the painting has settled (stats(), never a fixed wait);
 2. record every visible text line box (main, header, footer; SVG labels too; not the seal) with its colour, size
    and opacity (qa_common.LINES_JS);
 3. hide the glyphs only: text colour transparent, link underlines and brush marks off, SVG text unfilled. The
    canvas, the engine's veils (they read layout, not colour), every CSS background and border stay: what is left
    under a line is its real background;
 4. screenshot at the device pixel ratio and restore the text;
 5. per line (box inflated by 2 CSS px; one sample per CSS px, --fine for every device pixel): WCAG contrast of the
    text colour (alpha-composited per pixel) against each background pixel, and CIELAB chroma C* of the background.
Reported per line: p5 (the worst 5 % of pixels: the judged "worst pixel", robust to single grain dots), min (the
single worst pixel), mean contrast; chroma mean / p95 / max.
Targets: body and lead (> 14.5 px) p5 >= 7:1; small print (<= 14.5 px) p5 >= 4.5:1; chroma p95 <= 6 ("text never
sits on colour"; plain paper is about 1-3). Diagram labels (SVG text, e.g. Work's How I build) are their own
category, judged at 4.5:1 (DESIGN names no target for them; their p5 is listed so 7:1 can be applied by eye).
Lines under a fixed or sticky overlay (the returning header, the Note's progress line) are skipped.
Exit 1 on any failing line.
"""
import sys, os, json, time
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

BODY_MIN, SMALL_MIN, CHROMA_MAX, SMALL_PX = 7.0, 4.5, 6.0, 14.5


def positions_for(spec, docH, vh):
    last = max(0.0, (docH - vh) / vh)
    if spec == "default":
        ps = [0, 0.25, 0.5, 0.75, 1.0, 1.5]
        k = 2.0
        while k < last:
            ps.append(k); k += 1.0
        ps.append(last)
    elif spec == "first":
        ps = [0]
    else:
        ps = [float(x) for x in spec.split(",") if x.strip()]
    out = []
    for p in ps:
        p = min(p, last)
        if not any(abs(p - o) < 0.05 for o in out):
            out.append(round(float(p), 3))
    return out


def analyse(img, line, dpr, fine=False):
    r, g, b, a = q.parse_css_color(line["color"])
    a *= line.get("alpha", 1.0)
    pad = 2
    x0, y0 = (line["x"] - pad) * dpr, (line["y"] - pad) * dpr
    x1, y1 = (line["x"] + line["w"] + pad) * dpr, (line["y"] + line["h"] + pad) * dpr
    step = 1 if fine else max(1, int(round(dpr)))
    cons, chs = [], []
    lum, lab = q.luminance, q.lab
    if a >= 0.999:
        lt = lum(r, g, b)
        cache = {}
        for px in img.pixels(x0, y0, x1, y1, step):
            v = cache.get(px)
            if v is None:
                lb = lum(*px)
                hi, lo = (lt, lb) if lt >= lb else (lb, lt)
                v = cache[px] = ((hi + 0.05) / (lo + 0.05), lab(*px)[3])
            cons.append(v[0]); chs.append(v[1])
    else:
        for px in img.pixels(x0, y0, x1, y1, step):
            br, bg, bb = px
            tr, tg, tb = (round(a * c + (1 - a) * d) for c, d in ((r, br), (g, bg), (b, bb)))
            cons.append(q.contrast(lum(tr, tg, tb), lum(*px))); chs.append(lab(*px)[3])
    if not cons:
        return None
    cons.sort(); chs.sort()
    return {"p5": round(q.percentile(cons, 0.05), 2), "min": round(cons[0], 2), "mean": round(sum(cons) / len(cons), 2),
            "cMean": round(sum(chs) / len(chs), 1), "c95": round(q.percentile(chs, 0.95), 1), "cMax": round(chs[-1], 1), "n": len(cons)}


def main():
    ap = q.parser(__doc__, pages=list(q.PAGES), vps=["1440", "390"])
    ap.add_argument("--positions", default="default", help="'default', 'first', or a comma list of scroll positions in screens")
    ap.add_argument("--fine", action="store_true", help="sample every device pixel (slower)")
    ap.add_argument("--shots", action="store_true", help="keep the text-hidden screenshots (+ an HTML overlay) under $QA_OUT/contrast/")
    ap.add_argument("--worst", type=int, default=12, help="how many worst lines to list (default %(default)s)")
    a = ap.parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    shots = q.out_dir("contrast") if a.shots else None
    res = {"base": a.base, "query": a.query, "targets": {"body": BODY_MIN, "small": SMALL_MIN, "chroma95": CHROMA_MAX}, "runs": []}
    summary, fails = [], []
    with q.session() as pg:
        for vp in vps:
            dpr = q.VIEWPORTS[vp][2]
            for page in pages:
                st = pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                pg.add_style(q.NO_TRANSITIONS_CSS, "qa-notrans")   # colours must switch, not fade, when text hides
                docH = pg.ev("document.documentElement.scrollHeight")
                vh = q.VIEWPORTS[vp][1]
                run = {"page": page, "vp": vp, "settle": st, "positions": []}
                allrows = []
                for p in positions_for(a.positions, docH, vh):
                    y = round(p * vh)
                    s2 = pg.scroll_to(y, timeout=a.timeout)
                    pg.frames(3)
                    lines = pg.ev(q.LINES_JS) or []
                    stats = pg.stats() or {}
                    pg.add_style(q.HIDE_GLYPHS_CSS, "qa-hide")
                    pg.frames(2)
                    png = pg.png()
                    pg.remove_style("qa-hide")
                    img = q.Image.decode(png)
                    rows = []
                    for ln in lines:
                        m = analyse(img, ln, dpr, a.fine)
                        if not m:
                            continue
                        cat = "diagram" if ln["kind"] == "svg" else ("small" if ln["fs"] <= SMALL_PX else "body")
                        need = BODY_MIN if cat == "body" else SMALL_MIN
                        bad = []
                        if m["p5"] < need:
                            bad.append(f"contrast {m['p5']} < {need}")
                        if m["c95"] > CHROMA_MAX:
                            bad.append(f"chroma {m['c95']} > {CHROMA_MAX}")
                        row = {**{k: ln[k] for k in ("el", "text", "fs", "where", "kind", "color")}, "y": round(ln["y"]),
                               "x": round(ln["x"]), "w": round(ln["w"]), "h": round(ln["h"]), "cat": cat, **m, "fail": bad, "pos": p}
                        rows.append(row)
                        if bad:
                            fails.append(f"{page} {vp} @{p} screens: {ln['el']} '{ln['text'][:30]}' ({ln['fs']}px {cat}, y {round(ln['y'])}): {'; '.join(bad)}")
                    allrows += rows
                    pos = {"pos": p, "y": y, "settle": s2, "lines": len(rows),
                           "hzK": stats.get("hzK"), "windows": stats.get("windows"), "rows": rows}
                    if shots:
                        fn = f"{page}-{vp}-{str(p).replace('.', '_')}.png"
                        open(os.path.join(shots, fn), "wb").write(png)
                        pos["shot"] = fn
                    run["positions"].append(pos)
                body = [r for r in allrows if r["cat"] == "body"]
                small = [r for r in allrows if r["cat"] == "small"]
                diag = [r for r in allrows if r["cat"] == "diagram"]
                srow = {"page": page, "vp": vp, "pos": len(run["positions"]), "lines": len(allrows),
                        "body p5 min": q.fmt(min((r["p5"] for r in body), default=None)),
                        "body min px": q.fmt(min((r["min"] for r in body), default=None)),
                        "small p5 min": q.fmt(min((r["p5"] for r in small), default=None)),
                        "small min px": q.fmt(min((r["min"] for r in small), default=None)),
                        "diagram p5 min": q.fmt(min((r["p5"] for r in diag), default=None)),
                        "chroma p95 max": q.fmt(max((r["c95"] for r in allrows), default=None), 1),
                        "chroma mean max": q.fmt(max((r["cMean"] for r in allrows), default=None), 1),
                        "fails": sum(1 for r in allrows if r["fail"])}
                summary.append(srow)
                run["summary"] = srow
                run["worst"] = sorted(allrows, key=lambda r: r["p5"] / (BODY_MIN if r["cat"] == "body" else SMALL_MIN))[:a.worst]
                res["runs"].append(run)
                if shots:
                    write_overlay(shots, run, q.VIEWPORTS[vp])
                print(f"  {page} {vp}: {len(run['positions'])} positions, {len(allrows)} lines, "
                      f"body p5 >= {srow['body p5 min']}, small p5 >= {srow['small p5 min']}, chroma p95 <= {srow['chroma p95 max']}, fails {srow['fails']}", flush=True)
    q.table(summary, [("page", "page"), ("vp", "vp"), ("pos", "pos"), ("lines", "lines"), ("body p5 min", "body p5"),
                      ("body min px", "body min"), ("small p5 min", "small p5"), ("small min px", "small min"), ("diagram p5 min", "diagram p5"),
                      ("chroma p95 max", "C* p95"), ("chroma mean max", "C* mean"), ("fails", "fails")],
            title=f"Contrast on the real background (worst line per page; targets body >= {BODY_MIN}, small >= {SMALL_MIN}, C* p95 <= {CHROMA_MAX})")
    worst = sorted((r for run in res["runs"] for r in run["worst"]),
                   key=lambda r: r["p5"] / (BODY_MIN if r["cat"] == "body" else SMALL_MIN))[:a.worst]
    q.table([{**r, "where": f"{r['pos']}", "line": f"{r['el']} '{r['text'][:24]}'"} for r in worst],
            [("line", "line"), ("fs", "px"), ("cat", "cat"), ("where", "at scr"), ("y", "y"), ("p5", "p5"), ("min", "min"),
             ("mean", "mean"), ("cMean", "C* mean"), ("c95", "C* p95")],
            title="The lowest-margin lines overall")
    print(f"\n{len(fails)} failing line(s)." if fails else "\nNo failing line.")
    for f in fails[:40]:
        print("  " + f)
    res["fails"] = fails
    q.save_json(a.json, res)
    return 1 if fails else 0


def write_overlay(d, run, vp):
    """An HTML page per page x viewport: each text-hidden shot with its failing / weakest line boxes outlined."""
    w, h = vp[0], vp[1]
    parts = [f"<!doctype html><meta charset=utf-8><title>contrast {run['page']} {run['vp']}</title>",
             "<style>body{font:13px system-ui;margin:16px;background:#ddd}figure{margin:0 0 24px;width:%dpx}"
             "img{width:%dpx;height:%dpx;display:block}.b{position:absolute;outline:1px solid #0a0}.f{outline:2px solid #e00}"
             "figcaption{margin:4px 0}</style>" % (w, w, h)]
    for p in run["positions"]:
        if not p.get("shot"):
            continue
        parts.append(f"<figure><figcaption>{run['page']} {run['vp']} at {p['pos']} screens (y {p['y']}), hzK {p.get('hzK')}</figcaption>"
                     f"<div style='position:relative'><img src='{p['shot']}'>")
        for r in p["rows"]:
            cls = "b f" if r["fail"] else "b"
            parts.append(f"<div class='{cls}' title='{r['p5']} / C {r['c95']}' style='left:{r['x']}px;top:{r['y']}px;width:{r['w']}px;height:{r['h']}px'></div>")
        parts.append("</div></figure>")
    open(os.path.join(d, f"{run['page']}-{run['vp']}.html"), "w").write("".join(parts))


if __name__ == "__main__":
    sys.exit(main())

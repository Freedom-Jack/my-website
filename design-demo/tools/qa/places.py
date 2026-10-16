#!/usr/bin/env python3
"""places.py: the blind "tell the places apart" sheet (DESIGN 11.C) and, with --endings, the openings-vs-endings
sheet for 11.B.

    QA_OUT=<scratchpad>/qa python3 tools/qa/places.py --seed 7          # six phone strips, shuffled, lettered
    QA_OUT=<scratchpad>/qa python3 tools/qa/places.py --pure --seed 7   # the painting alone (veils, keep-outs off)
    QA_OUT=<scratchpad>/qa python3 tools/qa/places.py --endings --vps 1440   # opening | closing | story map

Blind sheet: the six places (Home, Work, Writing, Resume, Contact, 404) at 390 x 844 (DPR 3, phone), each page
settled, its text hidden (main invisible, the art boxes kept; veils stay bound as the page has them, or unbound
with --pure), the strip cropped from its art box's top to an equal height for all (--height, default the
tallest strip), shuffled with --seed into tiles A-F on one HTML page that cdp renders to a PNG. The files are
named by letter only; the ANSWER KEY IS PRINTED TO THE CONSOLE ONLY (never written to a file), so the sheet can
go straight to people new to the site. Numeric companion per tile (by letter): mean / p95 / max CIELAB chroma,
share of pixels darker than the paper, and the pairwise mean absolute difference between tiles (%).
Output: $QA_OUT/places/seed-<n>/sheet.png (+ sheet.html, tile-A.png ...). Never inside the repo.
"""
import sys, os, json, random, time, html
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

PURE_JS = """(async()=>{const m=await import('/assets/js/main.js');const L=m.site&&m.site.landscape;if(!L)return 0;
L.rebind({veil:[],keepout:[]});return 1})()"""
BOX_JS = """((sel)=>{const e=document.querySelector(sel);if(!e)return null;const b=e.getBoundingClientRect();
return [b.left,b.top,b.width,b.height]})"""
DESC = "Six places along one painted scroll. Which tiles are the same place, if any? Which one is the river market town? Which one is the ferry crossing?"


def strip_box(pg):
    return pg.ev(BOX_JS + "('main [data-landscape=\"strip\"]')")


def tile_metrics(img, step=3):
    chs, dark, n = [], 0, 0
    for px in img.pixels(0, 0, img.w, img.h, step):
        chs.append(q.chroma(*px))
        if q.luminance(*px) < 0.70:          # paper is ~0.87; mist and ink below 0.70
            dark += 1
        n += 1
    chs.sort()
    return {"cMean": round(sum(chs) / len(chs), 1), "c95": round(q.percentile(chs, 0.95), 1), "cMax": round(chs[-1], 1),
            "inked%": round(100 * dark / n, 1)}


def mad(a, b, step=3):
    """mean absolute RGB difference in % of 255, over the common area."""
    w, h = min(a.w, b.w), min(a.h, b.h)
    s = n = 0
    for pa, pb in zip(a.pixels(0, 0, w, h, step), b.pixels(0, 0, w, h, step)):
        s += abs(pa[0] - pb[0]) + abs(pa[1] - pb[1]) + abs(pa[2] - pb[2]); n += 3
    return round(100 * s / (255 * n), 2)


def render(pg, path_html, path_png, width):
    pg.open("file://" + path_html, [width, 240, 1, False], settle=False)
    pg.run.step({"wait_for": "document.readyState==='complete' && [...document.images].every(i=>i.complete)", "timeout": 10000})
    pg.run.step({"shot": path_png, "full": True})


def blind(a, pg):
    vp = a.vps[0] if a.vps else "390"
    W, H, dpr = q.VIEWPORTS[vp][:3]
    d = q.out_dir(os.path.join("places", f"seed-{a.seed}" + ("-pure" if a.pure else "")))
    caps = []
    for page in q.PLACES:
        pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
        pg.add_style(q.HIDE_MAIN_CSS, "qa-hide")
        if a.pure:
            pg.ev(PURE_JS)
        pg.frames(3)
        pg.settle(a.timeout)
        box = strip_box(pg)
        top = max(0, box[1]) if box else 0
        grab = min(H - top, max(a.height or 0, 240))            # generous; cropped to the common height below
        img = q.Image.decode(pg.png(clip=[0, top, W, grab]))
        caps.append({"page": page, "box": box, "img": img})
    hmax = a.height or max(round(c["box"][3]) for c in caps if c["box"])
    letters = "ABCDEF"
    order = list(range(len(caps)))
    random.Random(a.seed).shuffle(order)
    for k, idx in enumerate(order):
        c = caps[idx]
        c["letter"] = letters[k]
        c["img"] = c["img"].crop(0, 0, c["img"].w, round(hmax * dpr))
        c["file"] = f"tile-{c['letter']}.png"
        open(os.path.join(d, c["file"]), "wb").write(c["img"].to_png())
    caps.sort(key=lambda c: c["letter"])
    figs = "".join(f"<figure><img src='{c['file']}' width='{W}' height='{hmax}' alt=''><figcaption>{c['letter']}</figcaption></figure>"
                   for c in caps)
    page = (f"<!doctype html><meta charset=utf-8><title>Places sheet</title><style>"
            f"body{{margin:0;padding:24px;background:#d9dcdb;font:16px/1.4 system-ui,sans-serif;color:#222}}"
            f"p{{max-width:{3 * W + 48}px;margin:0 0 16px}}main{{display:grid;grid-template-columns:repeat(3,{W}px);gap:24px}}"
            f"figure{{margin:0}}img{{display:block;box-shadow:0 0 0 1px #b9bdbc}}figcaption{{font-weight:700;font-size:22px;margin-top:6px}}"
            f"</style><p>{html.escape(DESC)}</p><main>{figs}</main>")
    ph = os.path.join(d, "sheet.html")
    open(ph, "w").write(page)
    pp = os.path.join(d, "sheet.png")
    render(pg, ph, pp, 3 * W + 48 + 48)
    rows = []
    for c in caps:
        m = tile_metrics(c["img"])
        c["metrics"] = m
        rows.append({"tile": c["letter"], **m, "h": round(c["box"][3]) if c["box"] else None})
    q.table(rows, [("tile", "tile"), ("h", "strip h"), ("cMean", "C* mean"), ("c95", "C* p95"), ("cMax", "C* max"), ("inked%", "inked %")],
            title=f"Tiles ({W}x{hmax} CSS px each, DPR {dpr}{', pure' if a.pure else ''}); seed {a.seed}")
    pair = []
    for i in range(len(caps)):
        for j in range(i + 1, len(caps)):
            pair.append({"pair": caps[i]["letter"] + caps[j]["letter"], "mad": mad(caps[i]["img"], caps[j]["img"])})
    pair.sort(key=lambda p: p["mad"])
    print("\nPairwise mean absolute difference, % (lowest = most alike): " + "  ".join(f"{p['pair']} {p['mad']}" for p in pair))
    print(f"\n[sheet] {pp}")
    print("\nANSWER KEY (console only; do not show it to the people sorting the tiles):")
    print("  " + "  ".join(f"{c['letter']}={c['page']}" for c in caps))
    return {"seed": a.seed, "pure": a.pure, "vp": vp, "height": hmax, "sheet": pp,
            "tiles": {c["letter"]: c["metrics"] for c in caps}, "pairs": pair}


def endings(a, pg):
    out = {}
    vps = a.vps or ["1440"]
    d = q.out_dir("places/endings")
    for vp in vps:
        W, H, dpr = q.VIEWPORTS[vp][:3]
        rows_html, rows = [], []
        for page in [p for p in q.PAGES]:
            pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
            pg.add_style(q.HIDE_MAIN_CSS, "qa-hide")
            pg.frames(3); pg.settle(a.timeout)
            files = {}
            b = strip_box(pg)
            if b:
                fn = f"{page}-{vp}-open.png"
                open(os.path.join(d, fn), "wb").write(pg.png(clip=[0, max(0, b[1]), W, min(H - max(0, b[1]), b[3])]))
                files["open"] = fn
            cb = pg.ev(BOX_JS + "('main [data-landscape=\"closing\"]')")
            if cb:
                y = pg.ev("scrollY") + cb[1] - 0.3 * H
                pg.scroll_to(max(0, y), timeout=a.timeout)
                cb = pg.ev(BOX_JS + "('main [data-landscape=\"closing\"]')")
                fn = f"{page}-{vp}-close.png"
                open(os.path.join(d, fn), "wb").write(pg.png(clip=[0, max(0, cb[1]), W, min(H - max(0, cb[1]), cb[3])]))
                files["close"] = fn
            pg.scroll_to(pg.ev("document.documentElement.scrollHeight") , timeout=a.timeout)
            mb = pg.ev(BOX_JS + "('.story-map')")
            if mb:
                fn = f"{page}-{vp}-map.png"
                open(os.path.join(d, fn), "wb").write(pg.png(clip=[0, max(0, mb[1]), W, min(H - max(0, mb[1]), mb[3])]))
                files["map"] = fn
            out.setdefault(vp, {})[page] = files
            cells = "".join(f"<td>{('<img src=' + repr(files[k]) + '>') if k in files else '-'}</td>" for k in ("open", "close", "map"))
            rows_html.append(f"<tr><th>{html.escape(page)}</th>{cells}</tr>")
        scale = 0.5 if W > 800 else 1
        doc = (f"<!doctype html><meta charset=utf-8><title>Openings and endings {vp}</title><style>body{{margin:16px;background:#d9dcdb;"
               f"font:14px system-ui}}td,th{{vertical-align:top;padding:4px 8px;text-align:left}}img{{width:{int(W * scale)}px;display:block}}</style>"
               f"<table><tr><th></th><th>opening strip</th><th>closing scene</th><th>footer story map</th></tr>{''.join(rows_html)}</table>")
        ph = os.path.join(d, f"endings-{vp}.html"); open(ph, "w").write(doc)
        pp = os.path.join(d, f"endings-{vp}.png")
        render(pg, ph, pp, int(3 * W * scale + 160))
        print(f"[sheet] {pp}")
    return out


def main():
    ap = q.parser(__doc__)
    ap.add_argument("--vps", default="", help="viewport (blind: one, default 390; endings: comma list, default 1440)")
    ap.add_argument("--seed", type=int, default=1, help="shuffle seed (default %(default)s)")
    ap.add_argument("--height", type=int, default=0, help="tile height in CSS px (default: the tallest strip)")
    ap.add_argument("--pure", action="store_true", help="unbind veils and keep-outs: the painting alone")
    ap.add_argument("--endings", action="store_true", help="make the opening / closing / story-map sheet instead")
    a = ap.parse_args()
    a.vps = q.split(a.vps, q.VIEWPORTS) if a.vps else []
    with q.session() as pg:
        res = endings(a, pg) if a.endings else blind(a, pg)
    q.save_json(a.json, res)
    return 0


if __name__ == "__main__":
    sys.exit(main())

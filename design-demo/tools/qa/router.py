#!/usr/bin/env python3
"""router.py: a light check of the demo's same-document router (README "Router"; SPEC-R4A 15.3).

    python3 tools/qa/router.py                         # 1440 and 390
    python3 tools/qa/router.py --vps 390 --burst --json $QA_OUT/router.json

Path (real mouse clicks, hover first so prepare() runs): Home -(header nav)-> Work, scrolled to --y before
leaving -(its closing "Next: Resume")-> Resume -(header nav)-> Contact -(the home link)-> Home; then back x4
and forward x4 (history.back / forward). After every navigation (route:end, then the painting settled):
  - exactly one <main>; focus on main's h1 (forward navigations); #route-announcer reads the title;
  - one adopted page stylesheet; aria-current="page" on the matching header link;
  - stats().stretch equals the page's body[data-stretch] (the pan ended on the destination);
  - route:start -> route:swap time (the swap, ~160 ms by design) and route:end's readyAt;
  - back/forward: scrollY restored (Work comes back at the scroll it was left at);
  - console errors and exceptions (the designed 404's own "status of 404" line is ignored).
--burst adds a click burst (Work, Resume, Contact nav links 100 ms apart): it must end on Contact with one <main>.
"""
import sys, os, time, json
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

INSTALL = r"""(async()=>{ if (window.__qaR) return 'again';
  window.__qaR = []; window.__qaPrep = [];
  for (const t of ['route:start','route:swap','route:end','route:fallback'])
    document.addEventListener(t, (e) => __qaR.push({ t, d: e.detail || {}, at: Math.round(performance.now()) }));
  try { const m = await import('/assets/js/main.js'); await m.site.landReady; const L = m.site.landscape;
    if (L && L.prepare && !L.__qaWrapped) { const o = L.prepare.bind(L); L.prepare = (...a) => { __qaPrep.push(a[0]); return o(...a); }; L.__qaWrapped = 1; } }
  catch (e) { return 'no-engine'; }
  return 'ok'; })()"""

STATE = r"""(async()=>{ const m = await import('/assets/js/main.js'); const L = m.site && m.site.landscape; const s = L && L.stats ? L.stats() : null;
  const h1 = document.querySelector('main h1'); const ae = document.activeElement;
  const cur = [...document.querySelectorAll('.site-header a[aria-current="page"]')].map((a) => a.getAttribute('href'));
  const ev = window.__qaR || []; const starts = ev.filter((e) => e.t === 'route:start'); const swaps = ev.filter((e) => e.t === 'route:swap');
  const ends = ev.filter((e) => e.t === 'route:end'); const fb = ev.filter((e) => e.t === 'route:fallback');
  const ls = starts[starts.length - 1], lw = swaps[swaps.length - 1], le = ends[ends.length - 1];
  return { path: location.pathname, title: document.title, mains: document.querySelectorAll('main').length,
    focusH1: !!h1 && (ae === h1 || h1.contains(ae)), focus: ae ? ae.tagName.toLowerCase() + (ae.id ? '#' + ae.id : '') : null,
    announcer: (document.getElementById('route-announcer') || {}).textContent || '', adopted: document.adoptedStyleSheets.length,
    pageSheets: document.querySelectorAll('link[data-page-style]').length,
    current: cur, y: Math.round(scrollY), bodyStretch: Number(document.body.dataset.stretch),
    stretch: s ? s.stretch : null, sweeping: s ? s.sweeping : null,
    nStart: starts.length, nEnd: ends.length, nFallback: fb.length, fallback: fb.length ? fb[fb.length - 1].d : null,
    swapMs: ls && lw && lw.at >= ls.at ? lw.at - ls.at : null, readyAt: le ? Math.round(le.d.readyAt || 0) : null,
    kind: ls ? ls.d.kind : null, prepared: (window.__qaPrep || []).slice(-3) }; })()"""


def main():
    ap = q.parser(__doc__, vps=["1440", "390"])
    ap.add_argument("--y", type=int, default=1200, help="scroll Work to this y before leaving it (default %(default)s)")
    ap.add_argument("--burst", action="store_true", help="also run a 100 ms click burst")
    a = ap.parse_args()
    vps = q.split(a.vps, q.VIEWPORTS)
    res, rows, bad = {"base": a.base, "runs": []}, [], []
    with q.session() as pg:
        for vp in vps:
            pg.open(q.url(a.base, "home", a.query), vp, timeout=a.timeout)
            pg.console()
            inst = pg.ev(INSTALL)
            log = []

            def after(label, expect, kind, prev_end, want_y=None, want_focus=True):
                ok_end = pg.run.step({"wait_for": f"(window.__qaR||[]).filter(e=>e.t==='route:end').length>{prev_end} && location.pathname==={json.dumps(expect)}",
                                      "timeout": 12000})
                pg.settle(a.timeout)
                time.sleep(0.25)       # the announcer writes 50 ms + a frame after the swap
                s = pg.ev(STATE)
                errs = pg.errors()
                probs = []
                if not ok_end:
                    probs.append("no route:end / wrong path")
                if s["path"] != expect:
                    probs.append(f"path {s['path']}")
                if s["mains"] != 1:
                    probs.append(f"{s['mains']} <main>")
                if want_focus and not s["focusH1"]:
                    probs.append(f"focus on {s['focus']}")
                if s["title"] and s["announcer"].strip() != s["title"].strip():
                    probs.append("announcer != title")
                if s["adopted"] > 1:
                    probs.append(f"{s['adopted']} adopted sheets")
                if expect not in s["current"]:
                    probs.append(f"aria-current {s['current']}")
                if s["stretch"] is not None and s["stretch"] != s["bodyStretch"]:
                    probs.append(f"pan ended on {s['stretch']} not {s['bodyStretch']}")
                if want_y is not None and abs(s["y"] - want_y) > 2:
                    probs.append(f"scrollY {s['y']} (want {want_y})")
                if s["nFallback"]:
                    probs.append(f"fallback {s['fallback']}")
                if errs:
                    probs.append(f"console: {errs[:2]}")
                row = {"vp": vp, "step": label, "kind": s["kind"], "path": s["path"], "swap": s["swapMs"], "ready": s["readyAt"],
                       "focus": "h1" if s["focusH1"] else s["focus"], "y": s["y"], "stretch": f"{s['stretch']}/{s['bodyStretch']}",
                       "prep": ",".join(str(p) for p in s["prepared"]), "result": "ok" if not probs else "; ".join(probs)}
                log.append({**row, "state": s, "errors": errs})
                rows.append(row)
                if probs:
                    bad.append(f"{vp} {label}: {'; '.join(probs)}")
                return s["nEnd"], s

            n = pg.ev(STATE)["nEnd"]
            # Home -> Work (header nav)
            pg.run.step({"hover": ".site-nav a[href='/work/']"}); time.sleep(0.3)
            pg.run.step({"click": ".site-nav a[href='/work/']"})
            n, _ = after("home > work (nav)", "/work/", "push", n)
            # Work: scroll, then its closing link -> Resume
            pg.scroll_to(a.y, timeout=a.timeout)
            time.sleep(0.5)        # the router saves the scroll 200 ms after scrolling stops
            pg.run.step({"hover": "main .closing a.next"}); time.sleep(0.3)
            left_y = pg.ev("Math.round(scrollY)")
            pg.run.step({"click": "main .closing a.next"})
            n, _ = after("work > resume (Next)", "/resume/", "push", n)
            pg.run.step({"hover": ".site-nav a[href='/contact/']"}); time.sleep(0.3)
            pg.run.step({"click": ".site-nav a[href='/contact/']"})
            n, _ = after("resume > contact (nav)", "/contact/", "push", n)
            pg.run.step({"hover": ".site-header a.home-link"}); time.sleep(0.3)
            pg.run.step({"click": ".site-header a.home-link"})
            n, _ = after("contact > home (home link)", "/", "push", n)
            # back x4, forward x4
            for label, expect, y in (("back", "/contact/", None), ("back", "/resume/", None), ("back", "/work/", left_y), ("back", "/", 0)):
                pg.ev("history.back(), 1")
                n, _ = after(f"{label} > {expect}", expect, "pop", n, want_y=y, want_focus=False)
            for label, expect, y in (("forward", "/work/", left_y), ("forward", "/resume/", None), ("forward", "/contact/", None), ("forward", "/", None)):
                pg.ev("history.forward(), 1")
                n, _ = after(f"{label} > {expect}", expect, "pop", n, want_y=y, want_focus=False)
            if a.burst:
                for sel in (".site-nav a[href='/work/']", ".site-nav a[href='/resume/']", ".site-nav a[href='/contact/']"):
                    pg.ev("scrollTo({top:0,behavior:'instant'}),1")
                    pg.run.step({"click": sel})
                    time.sleep(0.1)
                pg.run.step({"wait_for": "location.pathname==='/contact/' && !document.documentElement.classList.contains('is-routing')", "timeout": 12000})
                pg.settle(a.timeout); time.sleep(0.4)
                s = pg.ev(STATE)
                errs = pg.errors()
                ok = s["path"] == "/contact/" and s["mains"] == 1 and not errs
                rows.append({"vp": vp, "step": "burst x3 @100ms", "kind": s["kind"], "path": s["path"], "swap": s["swapMs"], "ready": s["readyAt"],
                             "focus": "h1" if s["focusH1"] else s["focus"], "y": s["y"], "stretch": f"{s['stretch']}/{s['bodyStretch']}",
                             "prep": "", "result": "ok" if ok else f"ended {s['path']}, {s['mains']} main, {errs[:2]}"})
                if not ok:
                    bad.append(f"{vp} burst: ended on {s['path']} with {s['mains']} <main>; {errs[:2]}")
            res["runs"].append({"vp": vp, "install": inst, "steps": log})
    q.table(rows, [("vp", "vp"), ("step", "step"), ("kind", "kind"), ("swap", "swap ms"), ("ready", "ready ms"), ("focus", "focus"),
                   ("y", "scrollY"), ("stretch", "pan/page"), ("prep", "prepare()"), ("result", "result")],
            title="Router: Home > Work > Resume > Contact > Home, back x4, forward x4")
    print(f"\n{len(bad)} problem(s):" if bad else "\nAll router checks pass.")
    for b in bad:
        print("  " + b)
    res["problems"] = bad
    q.save_json(a.json, res)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

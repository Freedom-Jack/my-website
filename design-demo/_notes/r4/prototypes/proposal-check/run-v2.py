#!/usr/bin/env python3
"""Measure the v2 spec-check wireframes with the audit's own measure.js (same metrics as audit.md), plus a few
extra probes. usage: run-v2.py [page,...] [vp,...]   Writes data to r4/proposal-check/data/, shots to shots/director/."""
import json, subprocess, sys, os
S = "/private/tmp/claude-502/-Users-jackxu-Personal-Projects-my-website/6b2ac6ea-3e07-4500-ace8-b814e8aaaede/scratchpad"
CDP = f"{S}/bin/cdp.py"
OUT = f"{S}/r4/proposal-check/data"; SH = f"{S}/shots/director"
os.makedirs(OUT, exist_ok=True)
VPS = {"1440": [1440, 900, 1, False], "1280": [1280, 720, 1, False], "1024": [1024, 768, 1, False],
       "768": [768, 1024, 2, True], "390": [390, 844, 3, True], "375x667": [375, 667, 3, True],
       "360": [360, 780, 3, True], "844x390": [844, 390, 3, True]}
pages = sys.argv[1].split(",") if len(sys.argv) > 1 else ["home", "work"]
vps = sys.argv[2].split(",") if len(sys.argv) > 2 else list(VPS)
measure = open(f"{S}/r4/audit/measure.js").read()
probe = r"""(() => {
  const r = e => e && e.getBoundingClientRect();
  const R = Math.round;
  const words = (el) => el ? el.innerText.trim().split(/\s+/).filter(Boolean).length : 0;
  const vh = innerHeight;
  // words fully above the fold, split into real copy and placeholder copy (.ph)
  let real = 0, ph = 0;
  const tw = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  let n; while ((n = tw.nextNode())) { const el = n.parentElement; if (!el) continue;
    const re = /\S+/g; let m; while ((m = re.exec(n.nodeValue))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const b = rg.getClientRects()[0]; if (!b || b.width < 1) continue; if (b.top < vh && b.bottom > 0) { if (el.closest('.ph')) ph++; else real++; } } }
  const jack = (() => { const t = [...document.querySelectorAll('main p')].find(p => /call me Jack/.test(p.textContent)); if (!t) return null;
    const rg = document.createRange(); const i = t.firstChild.nodeValue.indexOf('Jack'); rg.setStart(t.firstChild, i); rg.setEnd(t.firstChild, i + 4); return R(rg.getBoundingClientRect().top); })();
  const img = document.querySelector('main img'); const strip = document.querySelector('.strip'); const h1 = document.querySelector('h1');
  const lede = document.querySelector('.head .lede'); const rows = [...document.querySelectorAll('#t tbody tr')];
  const header = document.querySelector('.site-header');
  return { vw: innerWidth, vh, docH: document.documentElement.scrollHeight, hScroll: document.documentElement.scrollWidth > innerWidth,
    wordsAboveFold: { real, placeholder: ph }, jackY: jack,
    header: header && { h: R(r(header).height), linksFit: [...header.querySelectorAll('a')].every(a => r(a).top < r(header).bottom) },
    strip: strip && { top: R(r(strip).top), h: R(r(strip).height), x0: R(r(strip).left), x1: R(r(strip).right) },
    h1: h1 && { top: R(r(h1).top), fs: getComputedStyle(h1).fontSize, x0: R(r(h1).left), x1: R(r(h1).right) },
    lede: lede && { top: R(r(lede).top), bottom: R(r(lede).bottom), x0: R(r(lede).left), x1: R(r(lede).right), fs: getComputedStyle(lede).fontSize },
    photo: img && { top: R(r(img).top), w: R(r(img).width), h: R(r(img).height), visiblePx: Math.max(0, Math.min(vh, r(img).bottom) - r(img).top) },
    rowsInView: rows.filter(t => r(t).bottom <= vh).length, firstRowTop: rows[0] ? R(r(rows[0]).top) : null,
    paint: window.__strip || null };
})()"""
for page in pages:
    for vp in vps:
        url = f"file://{S}/r4/proposal-check/{page}-v2.html"
        st = [{"viewport": VPS[vp]}, {"goto": url}, {"wait": 2500},
              {"cdp": "Runtime.evaluate", "params": {"expression": measure, "returnByValue": True, "awaitPromise": True}, "save": f"{OUT}/{page}-{vp}.json"},
              {"cdp": "Runtime.evaluate", "params": {"expression": probe, "returnByValue": True}, "save": f"{OUT}/{page}-{vp}-probe.json"},
              {"shot": f"{SH}/r4b-{page}-{vp}.png"}]
        if vp in ("390", "1440"):
            st += [{"scroll": VPS[vp][1]}, {"wait": 300}, {"shot": f"{SH}/r4b-{page}-{vp}-s2.png"}]
        p = subprocess.run(["python3", CDP, json.dumps(st)], capture_output=True, text=True)
        try:
            m = json.load(open(f"{OUT}/{page}-{vp}.json"))["result"]["value"]
            pr = json.load(open(f"{OUT}/{page}-{vp}-probe.json"))["result"]["value"]
        except Exception as e:
            print(page, vp, "FAILED", e, p.stdout[-400:], p.stderr[-400:]); continue
        s0 = m["perScreen"][0]
        tot_d = sum(s["displayPct"] for s in m["perScreen"]); tot_r = sum(s["readPct"] for s in m["perScreen"])
        summ = {"page": page, "vp": vp, "screens": m["screens"], "s0_words": s0["words"], "s0_sizes": s0["sizes"],
                "s0_disp_over_read": round(s0["displayPct"] / max(0.1, s0["readPct"]), 2),
                "page_disp_over_read": round(tot_d / max(0.1, tot_r), 2),
                "max_sizes_per_screen": max(len(s["sizes"]) for s in m["perScreen"]),
                "gaps_median": m["gaps"]["medianGap"], "gap_largest": m["gaps"]["largest"][:2] and [g["gap"] for g in m["gaps"]["largest"][:3]],
                **pr}
        json.dump(summ, open(f"{OUT}/{page}-{vp}-summary.json", "w"), indent=1)
        print(json.dumps(summ))

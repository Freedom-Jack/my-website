#!/usr/bin/env python3
"""frames.py: what the engine paints while you scroll and while you read (DESIGN 7 engine discipline, 11.A
"phones stay calm"; README "a phone reading on paper requests no frames").

    python3 tools/qa/frames.py                                   # Home and Work at 390 (phone) and 1440
    python3 tools/qa/frames.py --pages home,work,resume --vps 390,1280,1440 --json $QA_OUT/frames.json

Per page and viewport: settle; then a scripted mouse-wheel scroll from the top to the bottom (--step px every
--every ms), sampling stats() after every wheel tick; then idle phases with no input (--idle s each) at the top
and in the middle of the page. Counted from stats(): frames (loop ticks that did work), presents (canvas
composites), scenes (window or band re-renders) and drafts. Also rAF intervals of the page (p50 / p95 / max) and
long tasks during the scroll.
  - "scenes" while scrolling must only be first paints of a window that comes on screen (the closing, the
    horizon band): a static buffer moves, it is never re-rendered by scrolling. Anything beyond that is
    listed as a re-render.
  - "on paper" = canvas presents (the cost) and engine loop ticks during scroll ticks with no window and no horizon on
    screen. Presents must be 0 (4a: "a phone reading on paper requests no frames"); a few loop ticks right after the
    strip leaves (the drift easing out) or before the closing arrives (it is prepared) are bookkeeping, not painting.
  - scenes are split into first paints, figure fades (a figure layer fading in, stats().figureSlots k < 1, repaints
    its window while it fades: e.g. Work's market inside Home's closing) and the rest, "re-renders", which must be 0.
  - idle fps: the ambient drift runs at <= 15 fps where art is on screen and sleeps after 45 s; with nothing on
    screen it must be 0.
"""
import sys, os, time, json
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

SAMPLE_JS = r"""(async()=>{const m=await import('/assets/js/main.js');const L=m.site&&m.site.landscape;const s=L&&L.stats?L.stats():null;
return {ok:!!s,y:Math.round(scrollY),f:s?s.frames:0,p:s?s.presents:0,sc:s?s.scenes:0,d:s?s.drafts:0,
 sv:!!(s&&s.windows.strip.visible),cv:!!(s&&s.windows.closing.visible),hz:s?s.hzK:0,amb:s?s.ambient:null,run:s?s.running:null,
 fig:s?Object.entries(s.figures||{}).filter(([k,v])=>v!=='none').map(([k,v])=>k+':'+v[0]).join(' '):'',
 fk:s?(s.figureSlots||[]).map(x=>x.stretch+':'+x.k).join(' '):''}})()"""

REC_START = r"""(()=>{const R=window.__qaF={iv:[],lt:[],on:true};let last=performance.now();
const f=(t)=>{if(!R.on)return;R.iv.push(t-last);last=t;requestAnimationFrame(f)};requestAnimationFrame(f);
try{R.po=new PerformanceObserver(l=>{for(const e of l.getEntries())R.lt.push(Math.round(e.duration))});R.po.observe({type:'longtask'})}catch(e){}
return 1})()"""
REC_STOP = r"""(()=>{const R=window.__qaF;if(!R)return null;R.on=false;try{R.po&&R.po.disconnect()}catch(e){}
const iv=R.iv.slice(1).sort((a,b)=>a-b);const pc=(p)=>iv.length?Math.round(iv[Math.min(iv.length-1,Math.floor(p*(iv.length-1)))]*10)/10:null;
return {n:iv.length,p50:pc(.5),p95:pc(.95),max:iv.length?Math.round(iv[iv.length-1]):null,longtasks:R.lt.length,longMax:R.lt.length?Math.max(...R.lt):0}})()"""


def main():
    ap = q.parser(__doc__, pages=["home", "work"], vps=["390", "1440"])
    ap.add_argument("--step", type=int, default=100, help="wheel deltaY per tick, px (default %(default)s)")
    ap.add_argument("--every", type=int, default=50, help="ms between wheel ticks (default %(default)s)")
    ap.add_argument("--idle", type=float, default=5.0, help="seconds per idle phase (default %(default)s)")
    a = ap.parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    res, rows, idle_rows, notes = {"base": a.base, "runs": []}, [], [], []
    with q.session() as pg:
        for vp in vps:
            W, H = q.VIEWPORTS[vp][:2]
            for page in pages:
                pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                time.sleep(1.0)
                docH = pg.ev("document.documentElement.scrollHeight")
                end = docH - H
                # ---- the scroll
                s_prev = s0 = pg.ev(SAMPLE_JS)
                if not s0.get("ok"):
                    notes.append(f"{page} {vp}: no landscape stats() (engine not mounted?); counts below are not meaningful")
                pg.ev(REC_START)
                samples, t0, ticks, stuck = [s0], time.time(), 0, 0
                while ticks < 2000:
                    pg.tab.call("Input.dispatchMouseEvent", type="mouseWheel", x=W // 2, y=H // 2, deltaX=0, deltaY=a.step)
                    ticks += 1
                    time.sleep(a.every / 1000)
                    s = pg.ev(SAMPLE_JS)
                    samples.append(s)
                    if s["y"] >= end - 1:
                        break
                    stuck = stuck + 1 if s["y"] == s_prev["y"] else 0
                    if stuck > 40:
                        notes.append(f"{page} {vp}: the wheel stopped scrolling at y {s['y']} of {end}")
                        break
                    s_prev = s
                time.sleep(1.0)
                s_end = pg.ev(SAMPLE_JS)
                samples.append(s_end)
                dur = time.time() - t0
                rec = pg.ev(REC_STOP) or {}
                tot = {k: s_end[k] - s0[k] for k in ("f", "p", "sc", "d")}
                # first paints allowed: the closing coming on screen, the horizon band coming in
                first = (1 if (not s0["cv"] and any(x["cv"] for x in samples)) else 0) + \
                        (1 if (s0["hz"] == 0 and any(x["hz"] > 0 for x in samples)) else 0)
                scene_at = [b["y"] for a_, b in zip(samples, samples[1:]) if b["sc"] > a_["sc"]]
                # what the figure layers were doing around each scene (a layer arriving or fading in repaints a window)
                scene_ctx = [{"y": b["y"], "before": a_.get("fig", ""), "after": b.get("fig", ""), "slots": b.get("fk", "")}
                             for a_, b in zip(samples, samples[1:]) if b["sc"] > a_["sc"]]
                paper = [(a_, b) for a_, b in zip(samples, samples[1:])
                         if not (a_["sv"] or a_["cv"] or a_["hz"] > 0) and not (b["sv"] or b["cv"] or b["hz"] > 0)]
                paper_f = sum(b["f"] - a_["f"] for a_, b in paper)        # loop ticks (bookkeeping, e.g. the drift easing out)
                paper_p = sum(b["p"] - a_["p"] for a_, b in paper)        # canvas composites: the real cost
                paper_ticks = sum(1 for a_, b in zip(samples, samples[1:])
                                  if not (a_["sv"] or a_["cv"] or a_["hz"] > 0) and not (b["sv"] or b["cv"] or b["hz"] > 0))
                full_scenes = tot["sc"] - tot["d"]
                partial = lambda fk: any(float(x.split(":")[1]) < 1 for x in fk.split()) if fk else False
                fades = sum(b["sc"] - a_["sc"] for a_, b in zip(samples, samples[1:])
                            if b["sc"] > a_["sc"] and (partial(a_.get("fk", "")) or partial(b.get("fk", ""))))
                rerender = max(0, full_scenes - first - fades)      # scenes neither a first paint nor a figure fade
                run = {"page": page, "vp": vp, "docH": docH, "ticks": ticks, "seconds": round(dur, 2), "totals": tot,
                       "firstPaints": first, "figureFades": fades, "scenesAtY": scene_at, "sceneContext": scene_ctx, "paperFrames": paper_f,
                       "paperPresents": paper_p, "paperTicks": paper_ticks,
                       "raf": rec, "samples": samples}
                rows.append({"page": page, "vp": vp, "ticks": ticks, "s": round(dur, 1),
                             "frames": tot["f"], "presents": tot["p"], "scenes": f"{tot['sc']} ({tot['d']}d)",
                             "first": first, "fades": fades, "rerender": rerender if rerender else "0 ok",
                             "paper": f"{paper_p}p {paper_f}f /{paper_ticks}t", "raf": f"{rec.get('p50')}/{rec.get('p95')}/{rec.get('max')}",
                             "long": f"{rec.get('longtasks')} ({rec.get('longMax')}ms)"})
                if rerender:
                    ctx = "; ".join(f"y {c['y']}: figures {c['before']} -> {c['after']}, slots {c['slots']}" for c in scene_ctx[:6])
                    notes.append(f"{page} {vp}: {rerender} scene(s) while scrolling that are neither a first paint ({first}) nor a figure fade ({fades}) ({ctx})")
                elif fades:
                    notes.append(f"{page} {vp}: info: {fades} scene(s) repainted while a figure layer faded in (slots k < 1), not by the scroll itself")
                if paper_p:
                    notes.append(f"{page} {vp}: {paper_p} present(s) while reading on paper, no art on screen (4a phones: 0)")
                # ---- idle: top and middle
                idle = {}
                for where, y in (("top", 0), ("mid", max(0, docH // 2 - H // 2))):
                    pg.scroll_to(y, timeout=a.timeout)
                    time.sleep(1.0)
                    i0 = pg.ev(SAMPLE_JS); time.sleep(a.idle); i1 = pg.ev(SAMPLE_JS)
                    idle[where] = {"y": y, "frames": i1["f"] - i0["f"], "presents": i1["p"] - i0["p"], "scenes": i1["sc"] - i0["sc"],
                                   "fps": round((i1["f"] - i0["f"]) / a.idle, 1), "art": bool(i1["sv"] or i1["cv"] or i1["hz"] > 0),
                                   "ambient": i1["amb"]}
                run["idle"] = idle
                idle_rows.append({"page": page, "vp": vp,
                                  "top": f"{idle['top']['fps']} fps ({idle['top']['scenes']} sc)" + ("" if idle["top"]["art"] else " no art"),
                                  "mid": f"{idle['mid']['fps']} fps ({idle['mid']['scenes']} sc)" + ("" if idle["mid"]["art"] else " no art")})
                for where, v in idle.items():
                    if v["fps"] > 15.5:
                        notes.append(f"{page} {vp}: idle {where} at {v['fps']} fps (> 15)")
                    if not v["art"] and v["frames"]:
                        notes.append(f"{page} {vp}: idle {where} with no art on screen still paints ({v['frames']} frames)")
                    if v["scenes"]:
                        notes.append(f"{page} {vp}: idle {where} re-rendered {v['scenes']} scene(s)")
                res["runs"].append(run)
                print(f"  {page} {vp}: {ticks} ticks, frames {tot['f']}, presents {tot['p']}, scenes {tot['sc']} ({tot['d']} drafts), "
                      f"paper frames {paper_f}, idle top {idle['top']['fps']} fps / mid {idle['mid']['fps']} fps", flush=True)
    q.table(rows, [("page", "page"), ("vp", "vp"), ("ticks", "ticks"), ("s", "s"), ("frames", "frames"), ("presents", "presents"),
                   ("scenes", "scenes"), ("first", "1st paints"), ("fades", "fig fades"), ("rerender", "re-renders"), ("paper", "on paper: presents, loop ticks / sampled ticks"),
                   ("raf", "rAF ms p50/p95/max"), ("long", "long tasks")],
            title=f"Scripted wheel scroll top -> bottom ({a.step} px every {a.every} ms)")
    q.table(idle_rows, [("page", "page"), ("vp", "vp"), ("top", f"idle {a.idle:g} s at top"), ("mid", "idle mid-page")], title="Idle")
    print("\nNotes:" if notes else "\nNo re-render on scroll; nothing paints with no art on screen.")
    for n in notes:
        print("  " + n)
    res["notes"] = notes
    q.save_json(a.json, res)
    return 1 if notes else 0


if __name__ == "__main__":
    sys.exit(main())

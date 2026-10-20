#!/usr/bin/env python3
"""gaps.py: the visible gaps between sections (DESIGN 6 budget row "Gaps between sections", SPEC-R4A 15.2/15.4.5).

    python3 tools/qa/gaps.py                         # 7 pages x 1440 / 1280 / 390
    python3 tools/qa/gaps.py --pages home,work --vps 1440,390 --json $QA_OUT/gaps.json

A visible gap = the bottom of the last visible thing of section N (its last text line, or a picture if one ends
lower) to the top of the first visible thing of section N+1, between consecutive children of <main> that are
sections. CSS-generated text counts as text (the folded cases' "Show details" line, as the 4a ruling did).
Targets: 56-80 at 1440, 56-72 at 1280, 40-56 at 390. Not gaps (SPEC 15.4.5, DESIGN 6): the strip -> the first
section and the last section -> the closing; they are printed in brackets for reference only.
"""
import sys, os
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

TARGET = {"1440": (56, 80), "1280": (56, 72), "390": (40, 56)}


def edges(s):
    last = max([v for v in (s.get("lastText"), s.get("graphicBottom")) if v is not None], default=None)
    first = min([v for v in (s.get("firstText"), s.get("graphicTop")) if v is not None], default=None)
    return first, last


def gaps_of(m):
    secs = [s for s in m["sections"] if s["lines"] or s.get("graphicBottom") is not None]
    out = []
    for a, b in zip(secs, secs[1:]):
        _, a_last = edges(a)
        b_first, _ = edges(b)
        if a_last is None or b_first is None:
            continue
        counted = a["kind"] == "section" and b["kind"] == "section"
        out.append({"after": a["el"], "lastEl": a["lastEl"], "before": b["el"], "firstEl": b["firstEl"],
                    "y": round(a_last), "gap": round(b_first - a_last, 1), "counted": counted,
                    "why": "" if counted else ("strip -> first section" if a["kind"] == "strip" else "-> closing")})
    return out


def main():
    a = q.parser(__doc__, pages=list(q.PAGES), vps=q.BUDGET_VPS).parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    res, rows, fails = {"base": a.base, "pages": {}}, [], []
    with q.session() as pg:
        for page in pages:
            row = {"page": page}
            for vp in vps:
                pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                m = pg.call_js_file("measure.js", {})
                g = gaps_of(m)
                lo, hi = TARGET.get(vp, (None, None))
                counted = [x for x in g if x["counted"]]
                for x in counted:
                    x["ok"] = None if lo is None else lo <= round(x["gap"]) <= hi     # whole px, as the budget is written
                    if x["ok"] is False:
                        fails.append(f"{page} {vp}: {x['gap']} px between {x['after']} ({x['lastEl']}) and {x['before']} ({x['firstEl']}), target {lo}-{hi}")
                res["pages"].setdefault(page, {})[vp] = g
                cells = [f"{x['gap']:.0f}" + ("" if x["ok"] in (None, True) else "!") for x in counted]
                ex = [f"[{x['gap']:.0f}]" for x in g if not x["counted"]]
                row[vp] = (" ".join(cells) or "-") + ("  " + " ".join(ex) if ex else "")
            rows.append(row)
    q.table(rows, [("page", "page")] + [(v, f"{v} ({TARGET[v][0]}-{TARGET[v][1]})" if v in TARGET else v) for v in vps],
            title="Visible gaps between sections, px, in page order (! = outside the target; [..] = strip/closing, not a gap)")
    print("\nOutside the target:" if fails else "\nAll gaps between sections inside the target.")
    for f in fails:
        print("  " + f)
    res["fails"] = fails
    q.save_json(a.json, res)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

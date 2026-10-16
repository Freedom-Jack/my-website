#!/usr/bin/env python3
"""budget.py: the DESIGN section 6 budget table (SPEC-R4A 15.2), measured per page and viewport with measure.js.

    python3 tools/qa/budget.py                                   # 7 pages x 1440 / 1280 / 390, the 4173 server
    python3 tools/qa/budget.py --base http://localhost:4181 --pages home,work --json $QA_OUT/budget.json
    python3 tools/qa/budget.py --matrix                          # + sideways overflow and header rows, README matrix

Rows (targets 1440 / 1280 / 390): first-screen words (Home >= 120 / 100 / 55, subpages >= 150 / 120 / 90);
display / readable text area (Home <= .25, others <= .10; first screen and whole page); type sizes per screen
(<= 4, chrome excluded); the name (~72 / 68 / 45) and page titles (<= 40 / 40 / 32); the photo's top on the first
screen (Home); motion ([data-reveal] = 0, [data-arrive] only on .name); sideways overflow; standalone tap targets
under 44 x 44 (inline links in sentences excepted); page length in screens (Work <= 5 / 6 / 8).
The accepted exceptions of DESIGN section 6 / SPEC 15.4 are marked "acc", not failed:
  - 5 type sizes on Home (the demo-only "Draft art" label), the Resume, Contact and Writing;
  - short pages (Contact, Writing, the Note, the 404) over .10 on wide screens;
  - a page whose whole content fits screen one reports a low word count ("fits");
  - the Resume and the Note 2-4 words short at 1440 / 1280 (SPEC 15.4.2);
  - Work's length is an open question for Jack (DESIGN 11.E.2): "open", not a failure of the build.
Words are judged with the 4a audit's rule (words4a: every token in main, as the budget was calibrated); the
stricter count (visible words with a letter or digit, no Draft-art note) is printed beside it.
LCP is not measured here (needs CPU throttling and a cold cache; see README Status of demo 4a).
"""
import sys, os
sys.dont_write_bytecode = True     # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_common as q

WORDS = {"home": {"1440": 120, "1280": 100, "390": 55}, "sub": {"1440": 150, "1280": 120, "390": 90}}
NAME = {"1440": 72, "1280": 68, "390": 45}
TITLE = {"1440": 40, "1280": 40, "390": 32}
WORK_LEN = {"1440": 5, "1280": 6, "390": 8}
FIVE_OK = {"home", "resume", "contact", "writing"}


def wide(vp):
    return q.VIEWPORTS[vp][0] >= 1200


def judge(page, vp, m):
    """-> (cells dict for the table, issues list of (status, text))."""
    c, issues = {}, []

    def note(status, text):
        if status != "ok":
            issues.append((status, f"{page} {vp}: {text}"))
        return status

    # words on screen one
    kind = "home" if page == "home" else "sub"
    tgt = WORDS[kind].get(vp)
    w4, ws = m["s0"]["words4a"], m["s0"]["words"]
    if tgt is None:
        st = "-"
    elif w4 >= tgt:
        st = "ok"
    elif m["fitsFirstScreen"]:
        st = note("fits", f"{w4} words < {tgt}, whole content on screen one (DESIGN 6 accepted)")
    elif page in ("resume", "note") and wide(vp) and tgt - w4 <= 5:
        st = note("acc", f"{w4} words, {tgt - w4} short of {tgt} (SPEC 15.4.2 accepted)")
    else:
        st = note("FAIL", f"first-screen words {w4} < {tgt} (strict count {ws})")
    c["words"] = f"{w4}/{ws} {st}"

    # display / readable
    lim = 0.25 if page == "home" else 0.10
    r0, rp = m["s0"]["ratio"] or 0, m["pageRatio"] or 0
    worst = round(max(r0, rp), 2)     # judged at the budget's own precision (two decimals)
    if worst <= lim:
        st = "ok"
    elif page in q.SHORT_PAGES and wide(vp):
        st = note("acc", f"display/read {r0:.2f} (s0) / {rp:.2f} (page) > {lim} (short page, wide: DESIGN 6 accepted)")
    else:
        st = note("FAIL", f"display/read {r0:.2f} (s0) / {rp:.2f} (page) > {lim}")
    c["ratio"] = f"{r0:.2f}/{rp:.2f} {st}"

    # type sizes per screen
    mx, mxn = m["maxSizesPerScreen"], m["maxSizesPerScreenNoNote"]
    if mx <= 4:
        st = "ok"
    elif mx == 5 and page in FIVE_OK:
        st = note("acc", f"5 type sizes on a screen (DESIGN 6 accepted for {page}; without the Draft-art note: {mxn})")
    else:
        worst_s = max(m["perScreen"], key=lambda p: len(p["sizes"]))
        st = note("FAIL", f"{mx} type sizes on screen {worst_s['i']} {worst_s['sizes']}")
    c["sizes"] = f"{mx} {st}"

    # largest text: the name on Home, the title elsewhere
    if page == "home":
        v, t = m["nameFs"], NAME.get(vp)
        st = "-" if t is None or v is None else ("ok" if abs(v - t) <= 2 else note("FAIL", f"name {v}px, target ~{t}"))
        c["type"] = f"name {q.fmt(v, 0)} {st}"
    else:
        v, t = m["h1Fs"], TITLE.get(vp)
        st = "-" if t is None or v is None else ("ok" if v <= t + 0.5 else note("FAIL", f"title {v}px > {t}"))
        c["type"] = f"h1 {q.fmt(v, 0)} {st}"
    if m["largest"] and m["h1Fs"] and m["largest"] > m["h1Fs"] + 0.5:
        note("FAIL", f"largest text {m['largest']}px ({m['largestEl']}) is bigger than the h1")

    # photo
    if page == "home":
        p = m["photo"]
        st = "ok" if p and p["onFirstScreen"] else note("FAIL", f"photo top {p and p['top']} not on the first screen ({m['vh']})")
        c["photo"] = f"{p and p['top']} {st}"
    else:
        c["photo"] = ""

    # motion
    ok = m["reveal"] == 0 and m["arriveOk"]
    c["motion"] = "ok" if ok else note("FAIL", f"data-reveal {m['reveal']}, data-arrive {m['arrive']}")

    # sideways
    o = m["overflow"]
    ok = not o["sideways"] and not o["offenderCount"]
    what = "sideways scroll" if (o["sideways"] or o.get("rightCount")) else "cut off at the left edge"
    c["sideways"] = "ok" if ok else note("FAIL", f"{what}: scrollWidth {o['scrollWidth']}, offenders {o['offenders'][:3]}")
    if o["scrollers"]:
        note("info", f"inner sideways scrollers {o['scrollers'][:3]}")

    # taps
    t = m.get("taps") or {}
    small = t.get("small", [])
    c["taps"] = f"{len(small)}/{t.get('standalone', 0)} " + ("ok" if not small else note(
        "FAIL", "tap targets < 44: " + "; ".join(f"{x['el']} '{x['name']}' {x['hitW']}x{x['hitH']}" for x in small[:6])))
    if t.get("covered"):
        note("info", f"tap targets whose centre is covered by something else: {t['covered'][:4]}")

    # length
    scr = m["screens"]
    if page == "work" and vp in WORK_LEN:
        lim = WORK_LEN[vp]
        st = "ok" if scr <= lim else note("open", f"Work is {scr} screens > {lim} (open question for Jack, DESIGN 11.E.2)")
    else:
        st = ""
    c["screens"] = f"{scr} {st}".strip()

    # header rows
    h = m.get("header") or {}
    c["header"] = f"{h.get('h')}px {h.get('rows')}r"
    if q.VIEWPORTS[vp][0] >= 360 and h.get("rows", 1) > 1:
        note("FAIL", f"header wraps into {h['rows']} rows at {q.VIEWPORTS[vp][0]} px")
    return c, issues


COLS = [("page", "page"), ("words", "words 4a/strict"), ("ratio", "disp/read s0/page"), ("sizes", "sizes/scr"),
        ("type", "largest"), ("photo", "photo top"), ("motion", "motion"), ("sideways", "sideways"),
        ("taps", "taps<44/n"), ("screens", "screens"), ("header", "header")]


def main():
    ap = q.parser(__doc__, pages=list(q.PAGES), vps=q.BUDGET_VPS)
    ap.add_argument("--matrix", action="store_true", help="also check sideways overflow + header rows at the README matrix sizes")
    a = ap.parse_args()
    pages, vps = q.split(a.pages, q.PAGES), q.split(a.vps, q.VIEWPORTS)
    results, issues = {"base": a.base, "query": a.query, "pages": {}}, []
    with q.session() as pg:
        for vp in vps:
            rows = []
            for page in pages:
                st = pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                m = pg.call_js_file("measure.js", {"taps": True})
                m["settle"] = st
                errs = pg.errors()
                m["consoleErrors"] = errs
                cells, iss = judge(page, vp, m)
                if errs:
                    iss.append(("FAIL", f"{page} {vp}: console errors {errs[:3]}"))
                if st["state"] == "timeout":
                    iss.append(("info", f"{page} {vp}: the painting did not settle within {a.timeout} ms"))
                issues += iss
                rows.append({"page": page, **cells})
                results["pages"].setdefault(page, {})[vp] = m
            w, h = q.VIEWPORTS[vp][:2]
            q.table(rows, COLS, title=f"Budget at {w}x{h} ({a.base}{'?' + a.query if a.query else ''})")
        if a.matrix:
            mrows = []
            for page in pages:
                row = {"page": page}
                for vp in q.MATRIX_VPS:
                    pg.open(q.url(a.base, page, a.query), vp, timeout=a.timeout)
                    m = pg.call_js_file("measure.js", {})
                    o, hd = m["overflow"], m.get("header") or {}
                    bad = o["sideways"] or o["offenderCount"]
                    tag = "SIDEWAYS " if (o["sideways"] or o.get("rightCount")) else "CUT-LEFT "
                    row[vp] = (tag if bad else "ok ") + f"{hd.get('rows')}r"
                    results["pages"].setdefault(page, {}).setdefault("matrix", {})[vp] = {"overflow": o, "header": hd}
                    w = q.VIEWPORTS[vp][0]
                    if bad:
                        issues.append(("FAIL", f"{page} {vp}: {tag.strip().lower()} {o['offenders'][:3]}"))
                    if w >= 360 and hd.get("rows", 1) > 1:
                        issues.append(("FAIL", f"{page} {vp}: header wraps ({hd.get('rows')} rows)"))
                mrows.append(row)
            q.table(mrows, [("page", "page")] + [(v, v) for v in q.MATRIX_VPS],
                    title="Sideways overflow and header rows (r = header rows; one row from 360 up, wraps below 340)")
    print("\nFindings (FAIL = over budget; acc / fits = DESIGN 6 accepted exception; open = Jack's call):")
    order = {"FAIL": 0, "open": 1, "acc": 2, "fits": 3, "info": 4}
    for s, t in sorted(issues, key=lambda x: order.get(x[0], 9)):
        print(f"  [{s}] {t}")
    if not issues:
        print("  none")
    results["issues"] = [{"status": s, "text": t} for s, t in issues]
    q.save_json(a.json, results)
    return 1 if any(s == "FAIL" for s, _ in issues) else 0


if __name__ == "__main__":
    sys.exit(main())

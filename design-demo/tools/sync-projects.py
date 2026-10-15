#!/usr/bin/env python3
"""Render Work's "In the open" from Jack's public GitHub repositories, at BUILD time (SPEC-R4A §13.6).

    python3 tools/sync-projects.py --discover   # GitHub API -> data/github.json, then render into work/index.html
    python3 tools/sync-projects.py              # render offline from data/github.json + data/projects.json
    python3 tools/sync-projects.py --check      # offline; exit 1 if the markup in work/index.html is stale
    python3 tools/sync-projects.py --page /tmp/copy.html   # (QA) render into another file instead

Jack (10 Oct 2026): "it should be able to look at my GitHub page and discover and update automatically ...
don't slow down the website just for live updating repos." So the list is fetched here, at build time, and
baked into static HTML between <!-- @data:projects --> and <!-- /@data:projects --> in work/index.html (the
Work page owner places the markers inside section#open). The visitor's browser never calls GitHub, and there is
zero client JS for it. No stars, heatmaps, widgets or language dots.

--discover: GET https://api.github.com/users/Freedom-Jack/repos?per_page=100&sort=pushed (public, no token,
a User-Agent, 10 s timeout). The snapshot of the candidates (public, not a fork, not archived, not empty, not
denied) is written to data/github.json: name, description, size (KB), fork, archived, pushed_at, created_at,
topics, html_url, sorted by name, plus the fetch time. On a network error nothing is written and the tool exits
non-zero (the section is never blanked). Rendering is always offline, from the snapshot, so --check is stable.

data/projects.json is OPTIONAL OVERRIDES only (Jack's own words, years, order, hides), one object per line:
    { "updated": "YYYY-MM-DD", "repos": [
      { "name": "world_qlearning", "year": 2020, "line": "A Q-learning agent ..." },
      ... ] }
  name     the repository name (required)
  line     Jack's words for it: one or two sentences, ending with a full stop, no year in it, <= 160 characters
  year     the year shown (default: the year of created_at)
  group    "featured" | "recent" | "early" (default: from the rules below)
  order    a number; lower first within its group (default: by date)
  hidden   true: never listed
  demo     an https URL: a "Live demo" link
The data file is served publicly, so it never names an excluded repository: the deny-list lives here (DENY).

Rules, in order: public; not a fork; not archived; size > 0; never a DENY repo (case-insensitive); skip
placeholders (size < 10 KB, or a description like "TBA", "To be announced/anounced", "coming soon"), which appear
by themselves once real code lands; needs a description or an override line; the line is the override's, else
the GitHub description, trimmed and ending with a full stop, <= 160 characters, refused if it holds CJK or a
phone-number pattern.
Groups: the topic "featured" (or group "featured") first; "Recent" = pushed within the 24 months before the
snapshot's fetch date, newest first; "Early work" = the rest, newest year first, then by name, headed "Early
work, {first}–{last}" when the newest year is 2020 or earlier, else "Earlier work, {first}–{last}". A group with
no entries renders nothing (no heading, no placeholder).
Markup (COPY.md 3.4): featured and recent as h3.sec__sub + ul.rows (h4.row__title > a.brush.brush--rest, the line,
p.row__meta.small "Updated {Month YYYY}" from pushed_at, and "Live demo" if any); the older group as h3.sec__sub +
div.table-wrap.wide > table.table.table--quiet (Year · Repository · What it is; caption visually hidden).

Next.js port: the Work page (a server component) fetches the same endpoint at build time with ISR
(revalidate: 86400) or a daily Vercel cron rebuild, optionally adding pinned repos via GraphQL with a
server-side token; the rules here become a tested module. Never client-side.

Owner: the design-system lead (schema, contents and this tool). Standard library only (Python 3.9+).
"""
import datetime
import html
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OVERRIDES = ROOT / "data" / "projects.json"
SNAPSHOT = ROOT / "data" / "github.json"
PAGE = ROOT / "work" / "index.html"
USER = "Freedom-Jack"
API = f"https://api.github.com/users/{USER}/repos?per_page=100&sort=pushed"
PREFIX = f"https://github.com/{USER}/"
MARK = re.compile(r"(?P<open>[ \t]*<!-- @data:projects -->)(?P<body>.*?)(?P<close><!-- /@data:projects -->)", re.S)

# Never listed (COPY.md 3.4). Personal application materials; and this site's own source, until its public
# history no longer holds the old résumé file.
DENY = {
    "job-application": "personal application materials; may contain contact details",
    "my-website": "withheld until the public repo no longer holds the old résumé file (COPY 3.4)",
}
PLACEHOLDER_KB = 10
PLACEHOLDER = re.compile(r"^(tba|to be (announced|anounced)|coming soon)\.?$", re.I)
RECENT_MONTHS = 24
LINE_MAX = 160
FIELDS = {"name"}
OPTIONAL = {"line", "year", "group", "order", "hidden", "demo"}
GROUPS = {"featured", "recent", "early"}
NAME = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
YEAR_IN_TEXT = re.compile(r"\b(19|20)\d{2}\b")
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
# CJK blocks, built from code points so that this file itself contains no such character or escape
CJK_RANGES = [(0x2E80, 0x2FDF), (0x3000, 0x303F), (0x3040, 0x30FF), (0x3100, 0x312F), (0x3190, 0x31FF),
              (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xA960, 0xA97F), (0xAC00, 0xD7AF), (0xF900, 0xFAFF),
              (0xFE30, 0xFE4F), (0xFF00, 0xFFEF), (0x20000, 0x3FFFF)]
CJK = re.compile("[" + "".join(re.escape(chr(a)) + "-" + re.escape(chr(b)) for a, b in CJK_RANGES) + "]")
PHONE = re.compile(r"(?<![\w.#-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w-])"
                   r"|\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}"
                   r"|\btel:", re.I)


class DataError(Exception):
    pass


def rel(path):
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def denied(name):
    return name.lower() in DENY


def esc(s):
    return html.escape(str(s), quote=True)


def when(iso):
    return datetime.datetime.strptime(iso[:10], "%Y-%m-%d").date()


# ------------------------------------------------------------------ the overrides
def load_overrides():
    if not OVERRIDES.exists():
        return {}
    raw = OVERRIDES.read_text(encoding="utf-8")
    errors = []
    if CJK.search(raw):
        errors.append("contains a CJK character (the only one allowed on the site is the seal, never here)")
    if PHONE.search(raw):
        errors.append(f"contains a phone-number pattern: {PHONE.search(raw).group(0)!r}")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise DataError(f"{rel(OVERRIDES)}: not valid JSON: {e}")
    if not isinstance(data, dict) or set(data) != {"updated", "repos"} or not isinstance(data["repos"], list):
        raise DataError(f'{rel(OVERRIDES)}: top level must be exactly {{ "updated": "YYYY-MM-DD", "repos": [ … ] }}')
    try:
        datetime.date.fromisoformat(str(data["updated"]))
    except ValueError:
        errors.append(f'"updated" must be a date, YYYY-MM-DD (got {data["updated"]!r})')
    out = {}
    for i, o in enumerate(data["repos"], 1):
        where = f"override {i} ({o.get('name', '?') if isinstance(o, dict) else '?'})"
        if not isinstance(o, dict):
            errors.append(f"{where}: must be an object")
            continue
        missing, extra = FIELDS - set(o), set(o) - FIELDS - OPTIONAL
        if missing:
            errors.append(f"{where}: missing {', '.join(sorted(missing))}")
            continue
        if extra:
            errors.append(f"{where}: unknown field(s) {', '.join(sorted(extra))}")
        name = o["name"]
        if not isinstance(name, str) or not NAME.match(name):
            errors.append(f"{where}: name must be the repository name (letters, digits, . _ -)")
            continue
        if denied(name):
            errors.append(f"{where}: {name} must never be named here ({DENY[name.lower()]})")
        if name.lower() in out:
            errors.append(f"{where}: listed twice")
        if "line" in o:
            errors += [f"{where}: {e}" for e in line_errors(o["line"])]
        if "year" in o and (not isinstance(o["year"], int) or isinstance(o["year"], bool) or not 2000 <= o["year"] <= 2100):
            errors.append(f"{where}: year must be a number such as 2020")
        if "group" in o and o["group"] not in GROUPS:
            errors.append(f'{where}: group must be "featured", "recent" or "early"')
        if "order" in o and (not isinstance(o["order"], (int, float)) or isinstance(o["order"], bool)):
            errors.append(f"{where}: order must be a number")
        if "hidden" in o and o["hidden"] is not True:
            errors.append(f"{where}: hidden must be true (or left out)")
        if "demo" in o and not (isinstance(o["demo"], str) and o["demo"].startswith("https://")):
            errors.append(f"{where}: demo must be an https URL")
        out[name.lower()] = o
    # one object per line, so that changing a repo is a one-line change
    one_line = [l for l in raw.splitlines() if re.match(r'^\s*\{\s*"name"', l)]
    if len(one_line) != len(data["repos"]) or any(not re.search(r"\}\s*,?\s*$", l) for l in one_line):
        errors.append('write each override as one object on one line, starting with "name"')
    if errors:
        raise DataError("\n".join(f"{rel(OVERRIDES)}: {e}" for e in errors))
    return out


def line_errors(line):
    if not isinstance(line, str) or not line.strip():
        return ["line is empty"]
    errs = []
    if not line.rstrip().endswith("."):
        errs.append("line must end with a full stop")
    if YEAR_IN_TEXT.search(line):
        errs.append("line must not contain a year (the year column shows it)")
    if len(line) > LINE_MAX:
        errs.append(f"line is longer than {LINE_MAX} characters")
    if CJK.search(line):
        errs.append("line contains a CJK character")
    if PHONE.search(line):
        errs.append("line contains a phone-number pattern")
    return errs


# ------------------------------------------------------------------ discovery (build time only)
def discover():
    req = urllib.request.Request(API, headers={
        "User-Agent": "qijinxu-site-build (tools/sync-projects.py)",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urllib.request.urlopen(req, timeout=10) as res:
        repos = json.load(res)
    if not isinstance(repos, list):
        raise DataError(f"unexpected API response: {str(repos)[:200]}")
    keep, dropped = [], []
    for r in repos:
        name = r.get("name", "")
        why = ("private" if r.get("private") else "a fork" if r.get("fork") else "archived" if r.get("archived")
               else "empty" if not r.get("size") else "denied" if denied(name) else None)
        if why:
            dropped.append((name if why != "denied" else "(a denied repository)", why))
            continue
        keep.append({k: r.get(k) for k in ("name", "description", "size", "fork", "archived", "pushed_at",
                                           "created_at", "topics", "html_url")})
    keep.sort(key=lambda r: r["name"].lower())
    snap = {
        "fetched": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": API,
        "note": "Build-time snapshot of the public candidates for Work's \"In the open\" (tools/sync-projects.py --discover). Never fetched by the browser.",
        "repos": keep,
    }
    text = "{\n" + "\n".join([
        f'  "fetched": {json.dumps(snap["fetched"])},',
        f'  "source": {json.dumps(snap["source"])},',
        f'  "note": {json.dumps(snap["note"], ensure_ascii=False)},',
        '  "repos": [',
        ",\n".join("    " + json.dumps(r, ensure_ascii=False) for r in keep),
        "  ]",
    ]) + "\n}\n"
    if CJK.search(text) or PHONE.search(text):
        raise DataError("the API returned a description with CJK or a phone pattern: refusing to write the snapshot")
    SNAPSHOT.write_text(text, encoding="utf-8")
    print(f"sync-projects: {len(repos)} public repositories; {len(keep)} candidates written to {rel(SNAPSHOT)}")
    for name, why in dropped:
        print(f"  dropped: {name}: {why}")


def load_snapshot():
    if not SNAPSHOT.exists():
        raise DataError(f"{rel(SNAPSHOT)} is missing: run python3 tools/sync-projects.py --discover")
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    for r in data.get("repos", []):
        if denied(r.get("name", "")):
            raise DataError(f"{rel(SNAPSHOT)} names a denied repository: re-run --discover")
    return data


# ------------------------------------------------------------------ the rules and the markup
def choose(snap, overrides):
    fetched = when(snap["fetched"])
    y, mth = divmod(fetched.year * 12 + fetched.month - 1 - RECENT_MONTHS, 12)
    cutoff = datetime.date(y, mth + 1, min(fetched.day, 28))   # 24 months before the snapshot (day clamped)
    entries, skipped = [], []
    for r in snap["repos"]:
        name = r["name"]
        o = overrides.get(name.lower(), {})
        desc = (r.get("description") or "").strip()
        if o.get("hidden"):
            skipped.append((name, "hidden by an override"))
            continue
        if (r.get("size") or 0) < PLACEHOLDER_KB or PLACEHOLDER.match(desc):
            skipped.append((name, f"placeholder ({r.get('size')} KB, {desc!r})"))
            continue
        line = (o.get("line") or desc).strip()
        if not line:
            skipped.append((name, "no description and no override line"))
            continue
        if not line.endswith("."):
            line += "."
        errs = line_errors(line)
        if errs and "line" not in o:
            skipped.append((name, f"its GitHub description needs an override line ({'; '.join(errs)})"))
            continue
        pushed = when(r["pushed_at"])
        group = o.get("group") or ("featured" if "featured" in (r.get("topics") or [])
                                   else "recent" if pushed >= cutoff else "early")
        entries.append({
            "name": name,
            "url": r.get("html_url") or PREFIX + name,
            "line": line,
            "year": o.get("year") or when(r["created_at"]).year,
            "pushed": pushed,
            "group": group,
            "order": o.get("order"),
            "demo": o.get("demo"),
        })
    for e in entries:
        if not str(e["url"]).startswith(PREFIX):
            raise DataError(f"{e['name']}: unexpected URL {e['url']}")
    return entries, skipped


def ordered(items, newest):
    big = float("inf")
    return sorted(items, key=lambda e: (e["order"] if e["order"] is not None else big, newest(e), e["name"].lower()))


def rows(title, items, indent):
    out = [f'<h3 class="sec__sub">{title}</h3>', '<ul class="rows" role="list">']
    for e in items:
        meta = f'Updated {MONTHS[e["pushed"].month - 1]} {e["pushed"].year}'
        if e["demo"]:
            meta += f' · <a class="brush brush--rest" href="{esc(e["demo"])}">Live demo</a>'
        out += [
            '  <li class="row ink-row">',
            f'    <h4 class="row__title"><a class="brush brush--rest" href="{esc(e["url"])}">{esc(e["name"])}</a></h4>',
            f'    <p class="row__line">{esc(e["line"])}</p>',
            f'    <p class="row__meta small">{meta}</p>',
            "  </li>",
        ]
    out.append("</ul>")
    return out


def render(entries, indent):
    featured = ordered([e for e in entries if e["group"] == "featured"], lambda e: -e["pushed"].toordinal())
    recent = ordered([e for e in entries if e["group"] == "recent"], lambda e: -e["pushed"].toordinal())
    early = ordered([e for e in entries if e["group"] == "early"], lambda e: -e["year"])
    out = []
    if featured:
        out += rows("Featured", featured, indent)
    if recent:
        out += rows("Recent", recent, indent)
    if early:
        years = sorted({e["year"] for e in early})
        span = f"{years[0]}–{years[-1]}" if len(years) > 1 else str(years[0])
        head = "Early work" if years[-1] <= 2020 else "Earlier work"
        out += [
            f'<h3 class="sec__sub">{head}, {span}</h3>',
            '<div class="table-wrap wide">',
            '  <table class="table table--quiet" role="table">',
            '    <caption class="table__caption visually-hidden">Early public repositories</caption>',
            '    <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Year</th>'
            '<th scope="col" role="columnheader">Repository</th><th scope="col" role="columnheader">What it is</th></tr></thead>',
            '    <tbody role="rowgroup">',
        ]
        for e in early:
            out.append(
                f'      <tr role="row"><td role="cell" data-label="Year">{e["year"]}</td>'
                f'<th scope="row" role="rowheader"><a class="brush brush--rest" href="{esc(e["url"])}">{esc(e["name"])}</a></th>'
                f'<td role="cell" data-label="What it is">{esc(e["line"])}</td></tr>'
            )
        out += ["    </tbody>", "  </table>", "</div>"]
    body = "\n".join(indent + l for l in out)
    note = ("<!-- generated at build time by tools/sync-projects.py from the GitHub API snapshot (data/github.json) "
            "and Jack's overrides (data/projects.json): edit the overrides, not this block -->")
    return "\n" + indent + note + ("\n" + body if out else "") + "\n" + indent


def main():
    global PAGE
    args = sys.argv[1:]
    check = "--check" in args
    if "--page" in args:
        PAGE = pathlib.Path(args[args.index("--page") + 1]).resolve()
    try:
        overrides = load_overrides()
        if "--discover" in args:
            if check:
                sys.exit("--check is offline; run --discover on its own")
            try:
                discover()
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                print(f"sync-projects: FAILED to reach the GitHub API ({e}); nothing was changed", file=sys.stderr)
                sys.exit(2)
        snap = load_snapshot()
        entries, skipped = choose(snap, overrides)
    except DataError as e:
        print(f"sync-projects: FAILED\n{e}", file=sys.stderr)
        sys.exit(1)
    text = PAGE.read_text(encoding="utf-8")
    m = MARK.search(text)
    if not m:
        print(f"sync-projects: no <!-- @data:projects --> … <!-- /@data:projects --> markers in "
              f"{rel(PAGE)} (the Work page owner places them inside section#open)", file=sys.stderr)
        sys.exit(1)
    indent = re.match(r"[ \t]*", m.group("open")).group(0)
    new = text[: m.start("body")] + render(entries, indent) + text[m.end("body"):]
    groups = {g: sum(e["group"] == g for e in entries) for g in ("featured", "recent", "early")}
    summary = f"featured {groups['featured']}, recent {groups['recent']}, early {groups['early']} (snapshot {snap['fetched'][:10]})"
    if not check:
        for name, why in skipped:
            print(f"  skipped: {name}: {why}")
    if new == text:
        print(f"sync-projects: {rel(PAGE)} in sync: {summary}")
        sys.exit(0)
    if check:
        print(f"sync-projects: {rel(PAGE)} is out of date; run python3 tools/sync-projects.py", file=sys.stderr)
        sys.exit(1)
    PAGE.write_text(new, encoding="utf-8")
    print(f"sync-projects: wrote {rel(PAGE)}: {summary}")


if __name__ == "__main__":
    main()

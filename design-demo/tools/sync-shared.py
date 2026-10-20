#!/usr/bin/env python3
"""Copy the shared blocks of _template.html into the pages of the demo.

    python3 tools/sync-shared.py                          # rewrite every page (design-system owner only)
    python3 tools/sync-shared.py --check                  # exit 1 if any page is out of date (no writes)
    python3 tools/sync-shared.py --only about/index.html  # rewrite just these pages (a page owner, own files)
    python3 tools/sync-shared.py --check --only work/index.html

Shared blocks are delimited in _template.html (and in each page) by
    <!-- @shared:NAME -->  ...  <!-- /@shared:NAME -->
Only the text between those markers is replaced; each page's own head, <main> and assets are
never touched. aria-current is set per page (SPEC-R4A §4, §5, §13.1) on the header nav and on the
footer's story map (exact page: "page"; its section, e.g. Writing in the story map for the Note:
"true"; the header nav has no Writing, so the Note marks nothing there; nothing at all on the 404),
and the home link (the seal and "Qijin Xu") is marked aria-current="page" on the home page.

Skipped: _template.html and everything under a folder starting with "_" (_studies, _lab, _tools),
assets/, tools/, data/, and any redirect stub (a page with <meta http-equiv="refresh">), which is a
minimal standalone page without shared blocks. One internal page is synced on purpose (INCLUDE):
_tools/components.html, the specimen sheet, so the shared chrome it shows is always the real one.

Owner: the design-system lead. Page builders never edit shared blocks by hand.
Standard library only (Python 3.9+).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "_template.html"
SKIP_DIRS = {"_studies", "assets", "tools", "data", "node_modules"}
INCLUDE = {"_tools/components.html"}          # internal pages that carry the real shared blocks
BLOCK = re.compile(r"<!-- @shared:(?P<name>[\w-]+) -->.*?<!-- /@shared:(?P=name) -->", re.S)
REFRESH = re.compile(r"<meta\s+http-equiv=[\"']?refresh", re.I)
STORY_MAP = re.compile(r'(<ol class="story-map__list"[^>]*>)(?P<body>.*?)(</ol>)', re.S)


def route_of(path: pathlib.Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def is_stub(text: str) -> bool:
    return bool(REFRESH.search(text))


def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if rel.as_posix() in INCLUDE:
            yield p
            continue
        if rel.parts[0] in SKIP_DIRS or any(part.startswith("_") for part in rel.parts):
            continue                      # _template.html, _studies/, _lab/ … are not pages
        yield p


def mark_links(block: str, route: str) -> str:
    """aria-current on every <a class="brush" href="/…"> in `block` (the 404 marks nothing)."""
    lost = route == "/404.html"

    def link(m):
        tag, href = m.group(0), m.group("href")
        tag = re.sub(r'\saria-current="[^"]*"', "", tag)
        if lost:
            return tag
        if href == route:
            state = "page"
        elif href != "/" and route.startswith(href):
            state = "true"
        else:
            return tag
        return tag[:-1] + f' aria-current="{state}">'

    return re.sub(r'<a class="brush" href="(?P<href>/[^"]*)"[^>]*>', link, block)


def mark_top(block: str, route: str) -> str:
    block = mark_links(block, route)

    def home(m):
        tag = re.sub(r'\saria-current="[^"]*"', "", m.group(0))
        return tag[:-1] + ' aria-current="page">' if route == "/" else tag

    return re.sub(r'<a class="home-link" href="/"[^>]*>', home, block)


def mark_bottom(block: str, route: str) -> str:
    # only the story map's five labels; the footer's other links (mailto, LinkedIn, GitHub, the PDF) are never current
    return STORY_MAP.sub(lambda m: m.group(1) + mark_links(m.group("body"), route) + m.group(3), block)


def main():
    args = sys.argv[1:]
    check = "--check" in args
    only = None
    if "--only" in args:
        names = [a for a in args[args.index("--only") + 1:] if not a.startswith("--")]
        if not names:
            sys.exit("--only needs at least one page path, e.g. --only about/index.html")
        only = set()
        for n in names:
            p = (ROOT / n).resolve() if not pathlib.Path(n).is_absolute() else pathlib.Path(n).resolve()
            if not p.exists():
                p = (pathlib.Path.cwd() / n).resolve()
            if not p.exists():
                sys.exit(f"--only: no such page: {n}")
            only.add(p)

    shared = {m.group("name"): m.group(0) for m in BLOCK.finditer(TEMPLATE.read_text(encoding="utf-8"))}
    stale = []
    for page in pages():
        if only is not None and page.resolve() not in only:
            continue
        text = page.read_text(encoding="utf-8")
        if is_stub(text):
            if only is not None:
                print(f"skipped (redirect stub): {page.relative_to(ROOT)}")
            continue
        route = route_of(page)

        def swap(m):
            name = m.group("name")
            if name not in shared:
                return m.group(0)
            block = shared[name]
            if name == "top":
                return mark_top(block, route)
            if name == "bottom":
                return mark_bottom(block, route)
            return block

        new = BLOCK.sub(swap, text)
        missing = set(shared) - {m.group("name") for m in BLOCK.finditer(text)}
        if missing:
            print(f"! {page.relative_to(ROOT)} has no marker for: {', '.join(sorted(missing))}")
        if new != text:
            stale.append(page)
            if not check:
                page.write_text(new, encoding="utf-8")
    for p in stale:
        print(("out of date: " if check else "synced: ") + str(p.relative_to(ROOT)))
    if not stale:
        print("all pages in sync" if only is None else "in sync")
    sys.exit(1 if (check and stale) else 0)


if __name__ == "__main__":
    main()

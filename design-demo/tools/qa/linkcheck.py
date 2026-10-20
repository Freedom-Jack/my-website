#!/usr/bin/env python3
"""Link crawl for the design demo (QA only, stdlib).

    python3 design-demo/tools/qa/linkcheck.py [--external]

- Parses every HTML page in design-demo/ (excluding _studies/, _notes/, _lab/, tools/ and _template.html) for
  href / src / srcset / inline url() references, plus url() inside every same-origin stylesheet they load.
- Requests each internal reference from http://localhost:4173 (start design-demo/_tools/serve.py first) and
  expects HTTP 200; checks that #fragments exist on their target page.
- Every external reference must be https and on an allowed host. With --external each one is requested once
  (normal certificate checks; a corporate-filter block is reported as such, never worked around).
Exit code 1 if anything internal is broken or an external link is not https / not allowed.
"""
import html.parser
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]          # design-demo/
BASE = "http://localhost:4173"
ALLOWED = {
    "github.com", "www.linkedin.com", "www.cgi.com", "fonts.googleapis.com", "fonts.gstatic.com",
    "vectorinstitute.ai", "cloud.google.com", "schema.org", "en.wikipedia.org", "www.yorku.ca",
    "www.microsoft.com", "raw.githubusercontent.com", "api.github.com",
    "my-website-freedomjack.vercel.app", "qijinxu.com", "www.qijinxu.com",
}
CSS_URL = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)")
DATA_URI = re.compile(r"""url\(\s*(['"]?)data:.*?\1\s*\)""", re.S)


class Refs(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids, self.styles = [], set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("name"):
            self.ids.add(a["name"])
        for key in ("href", "src"):
            v = a.get(key)
            if v and not (tag == "link" and a.get("rel") in ("preconnect", "dns-prefetch")):
                self.refs.append(v)
                if tag == "link" and "stylesheet" in (a.get("rel") or ""):
                    self.styles.append(v)
        if a.get("srcset"):
            self.refs += [s.strip().split(" ")[0] for s in a["srcset"].split(",") if s.strip()]
        if a.get("style"):
            self.refs += CSS_URL.findall(a["style"])


def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if rel.parts[0] in ("_studies", "_notes", "_lab", "tools") or p.name == "_template.html":
            continue
        yield p


def url_of(page):
    rel = page.relative_to(ROOT).as_posix()
    return BASE + "/" + (rel[:-len("index.html")] if rel.endswith("index.html") else rel)


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"error: {e}", b""


def main():
    external = "--external" in sys.argv
    bad, ext_refs, internal, ids_cache = [], set(), {}, {}
    for page in pages():
        base = url_of(page)
        parser = Refs()
        parser.feed(page.read_text("utf-8", errors="replace"))
        ids_cache[urllib.parse.urlparse(base).path] = parser.ids
        refs = list(parser.refs)
        for sheet in parser.styles:
            u = urllib.parse.urljoin(base, sheet)
            if u.startswith(BASE):
                status, body = fetch(u)
                if status == 200:
                    css = DATA_URI.sub("", body.decode("utf-8", "replace"))   # inner url()s of inline SVGs
                    for x in CSS_URL.findall(css):
                        # url(#id) in a stylesheet points at an element (an SVG filter) of the page using it
                        refs.append(x if x.startswith("#") else urllib.parse.urljoin(u, x))
        for ref in refs:
            if ref.startswith(("mailto:", "data:", "javascript:", "blob:")) or ref == "#":
                continue
            u = urllib.parse.urljoin(base, ref)
            parts = urllib.parse.urlparse(u)
            if u.startswith(BASE):
                internal.setdefault((parts.path or "/", parts.fragment), set()).add(page.relative_to(ROOT).as_posix())
            else:
                ext_refs.add(u)
    for (path, frag), where in sorted(internal.items()):
        status, body = fetch(BASE + path)
        if status != 200:
            bad.append(f"{path} -> {status}  (from {', '.join(sorted(where))[:120]})")
            continue
        if frag:
            ids = ids_cache.get(path)
            if ids is None:
                p = Refs(); p.feed(body.decode("utf-8", "replace")); ids = ids_cache[path] = p.ids
            if frag not in ids:
                bad.append(f"{path}#{frag} -> missing id  (from {', '.join(sorted(where))[:120]})")
    for u in sorted(ext_refs):
        parts = urllib.parse.urlparse(u)
        if parts.scheme != "https":
            bad.append(f"external link is not https: {u}")
        elif parts.hostname not in ALLOWED:
            bad.append(f"external host not allowed: {u}")
        elif external:
            status, _ = fetch(u)
            print(f"  {status}  {u}")
    print(f"{len(internal)} internal (path, fragment) references, {len(ext_refs)} external")
    for b in bad:
        print("BROKEN:", b)
    if bad:
        print("link check: FAIL")
        sys.exit(1)
    print("link check: all internal references resolve (200, fragments present); external links are https on allowed hosts")


if __name__ == "__main__":
    main()

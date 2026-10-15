#!/usr/bin/env python3
"""Print the web résumé to the one public PDF (SPEC-R3 §4.8, §9.6).

    python3 tools/build-pdf.py                       # http://localhost:4173/resume/ -> design-demo/resume.pdf
    python3 tools/build-pdf.py --url http://localhost:4173/resume/ --out /tmp/check.pdf

Single source: the PDF is the résumé page's own print stylesheet (@media print in pages/resume.css),
printed by headless Google Chrome with --print-to-pdf and --no-pdf-header-footer (no date, URL or page
numbers in the margins). The demo server must be running (python3 _tools/serve.py 4173).

PRIVACY GATE (fails loudly, and the PDF is never written into place):
  1. the page's HTML source, as served, must contain no phone-number pattern and no tel: link;
  2. the PDF's own text (extracted here with a minimal parser: inflated content streams, decoded through
     each font's ToUnicode map) must contain no phone-number pattern and no tel: link;
  3. the extraction must demonstrably work (the name, the city and the public email are found), so an
     empty or unreadable extraction can never pass the check silently.
The phone number is PENDING Jack's confirmation (COPY.md 10.8): until then there is none anywhere.
The PDF is rendered into a temporary file and moved into place only when every check passes.

Owner: the design-system lead (the résumé owner runs it after any résumé change).
Standard library only (Python 3.9+), plus Google Chrome.
"""
import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEFAULT_URL = "http://localhost:4173/resume/"
DEFAULT_OUT = ROOT / "resume.pdf"

PHONE = re.compile(
    r"(?<![\w.#/-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]{0,2}\d{3}[\s.-]\d{4}(?![\w-])"   # North American 3-3-4 groups
    r"|(?<![\d\w])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)"       # international, with a +
    r"|(?<![\d\w/#.-])\d{10}(?![\d\w])"                                               # ten digits in a row
    r"|\btel:",
    re.I)
MUST_FIND = ("Qijin", "Toronto", "qxjack@gmail.com")   # proof that the text extraction worked


class GateError(Exception):
    pass


# ---------------------------------------------------------------- a minimal PDF text extractor
OBJ = re.compile(rb"(\d+)\s+0\s+obj\b(.*?)\bendobj", re.S)


def objects(pdf):
    out = {}
    for m in OBJ.finditer(pdf):
        body = m.group(2)
        head, stream = body, None
        s = re.search(rb"\bstream\r?\n", body)
        if s:
            head = body[: s.start()]
            raw = body[s.end():]
            e = raw.rfind(b"endstream")
            raw = raw[:e].rstrip(b"\r\n") if e >= 0 else raw
            if b"/FlateDecode" in head:
                try:
                    raw = zlib.decompress(raw)
                except zlib.error:
                    try:
                        raw = zlib.decompressobj().decompress(raw)
                    except zlib.error:
                        raw = b""
            stream = raw
        out[int(m.group(1))] = (head, stream)
    return out


def hexstr(s):
    s = re.sub(rb"\s+", b"", s)
    if len(s) % 2:
        s += b"0"
    return bytes.fromhex(s.decode("ascii"))


def utf16(b):
    try:
        return b.decode("utf-16-be")
    except UnicodeDecodeError:
        return ""


def cmap(data):
    """ToUnicode CMap -> ({code bytes: text}, code width in bytes)."""
    table, width = {}, 1
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for src, dst in re.findall(rb"<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>", block):
            k = hexstr(src)
            width = max(width, len(k))
            table[k] = utf16(hexstr(dst))
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", data, re.S):
        for lo, hi, rest in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])", block):
            a, b = hexstr(lo), hexstr(hi)
            n = len(a)
            width = max(width, n)
            ia, ib = int.from_bytes(a, "big"), int.from_bytes(b, "big")
            if rest.startswith(b"["):
                dsts = [hexstr(x) for x in re.findall(rb"<([0-9A-Fa-f]+)>", rest)]
                for i, d in zip(range(ia, ib + 1), dsts):
                    table[i.to_bytes(n, "big")] = utf16(d)
            else:
                d = hexstr(rest[1:-1])
                base = int.from_bytes(d, "big")
                for off, i in enumerate(range(ia, ib + 1)):
                    table[i.to_bytes(n, "big")] = utf16((base + off).to_bytes(len(d), "big"))
    return table, width


LIT_ESC = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f", b"(": b"(", b")": b")", b"\\": b"\\"}


def literal(s):
    out, i = bytearray(), 0
    while i < len(s):
        c = s[i:i + 1]
        if c == b"\\" and i + 1 < len(s):
            n = s[i + 1:i + 2]
            if n in LIT_ESC:
                out += LIT_ESC[n]
                i += 2
                continue
            m = re.match(rb"[0-7]{1,3}", s[i + 1:i + 4])
            if m:
                out.append(int(m.group(0), 8) & 255)
                i += 1 + len(m.group(0))
                continue
            i += 1
            continue
        out += c
        i += 1
    return bytes(out)


TOKEN = re.compile(rb"/([^\s/\[\]()<>]+)|<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\)])*)\)|(\[)|(\])|([-+]?\d*\.?\d+)|([A-Za-z'\"*]+)", re.S)


class Font:
    """What text extraction needs from a font: its ToUnicode map and its glyph advances."""

    def __init__(self, head=b"", tounicode=None, descendant=b""):
        self.table, self.width = cmap(tounicode) if tounicode else ({}, 1)
        m = re.search(rb"/FontMatrix\s*\[\s*([-+\d.eE]+)", head)
        self.scale = abs(float(m.group(1))) if m else 0.001
        self.widths = {}
        m = re.search(rb"/FirstChar\s+(\d+)", head)
        first = int(m.group(1)) if m else 0
        m = re.search(rb"/Widths\s*\[([^\]]*)\]", head)
        if m:                                   # a simple or Type3 font
            for k, w in enumerate(re.findall(rb"[-+\d.]+", m.group(1))):
                self.widths[first + k] = float(w)
        m = re.search(rb"/W\s*\[((?:[^\[\]]|\[[^\]]*\])*)\]", descendant)
        if m:                                   # a CID font: [c [w1 w2 …]  c_first c_last w …]
            toks = re.findall(rb"\[[^\]]*\]|[-+\d.]+", m.group(1))
            i = 0
            while i < len(toks):
                c = int(float(toks[i]))
                if i + 1 < len(toks) and toks[i + 1].startswith(b"["):
                    for k, w in enumerate(re.findall(rb"[-+\d.]+", toks[i + 1])):
                        self.widths[c + k] = float(w)
                    i += 2
                elif i + 2 < len(toks):
                    for cid in range(c, int(float(toks[i + 1])) + 1):
                        self.widths[cid] = float(toks[i + 2])
                    i += 3
                else:
                    break

    def codes(self, s):
        n = self.width if self.table else 1
        return [s[i:i + n] for i in range(0, len(s), n)]

    def text(self, code):
        return self.table.get(code, "") if self.table else code.decode("latin-1")

    def advance(self, code, size):
        return self.widths.get(int.from_bytes(code, "big"), 0.0) * self.scale * size


NO_FONT = Font()


def page_text(content, fonts):
    """Text of one content stream. Chrome (Skia) places glyph by glyph (`dx 0 Td <xx> Tj`) and draws no
    space glyphs, so words and lines are rebuilt from geometry: a gap wider than a quarter of the font size
    is a space; a change of baseline is a new line."""
    lines, cur = [], []
    font, size = NO_FONT, 1.0
    lx = x = y = 0.0                # line start (moved by Td/Tm), pen (moved by glyphs), baseline
    end = None                      # where the last glyph ended on this baseline
    stack = []
    in_array = None

    def newline():
        nonlocal cur, end
        if cur:
            lines.append("".join(cur))
        cur, end = [], None

    def show(parts):
        nonlocal x, end
        for part in parts:
            if isinstance(part, float):            # a TJ kern, thousandths of the font size
                x -= part / 1000.0 * size
                continue
            for code in font.codes(part):
                if end is not None and x - end > 0.25 * size:
                    cur.append(" ")
                cur.append(font.text(code))
                x += font.advance(code, size)
                end = x

    for m in TOKEN.finditer(content):
        name, hx, lit, lb, rb, num, op = m.groups()
        if lb is not None:
            in_array = []
            continue
        if rb is not None:
            stack.append(in_array or [])
            in_array = None
            continue
        if hx is not None or lit is not None:
            s = hexstr(hx) if hx is not None else literal(lit)
            (in_array if in_array is not None else stack).append(s)
            continue
        if num is not None:
            (in_array if in_array is not None else stack).append(float(num))
            continue
        if name is not None:
            stack.append(name)
            continue
        if op is None or in_array is not None:
            continue
        nums = [v for v in stack if isinstance(v, float)]
        if op == b"Tf" and len(stack) >= 2 and isinstance(stack[-2], bytes):
            font, size = fonts.get(stack[-2], NO_FONT), abs(stack[-1]) if isinstance(stack[-1], float) else size
        elif op == b"Tm" and len(nums) >= 6:
            nx, ny = nums[-2], nums[-1]
            if abs(ny - y) > 0.5:
                newline()
            lx = x = nx
            y = ny
        elif op in (b"Td", b"TD") and len(nums) >= 2:
            if abs(nums[-1]) > 0.5:
                newline()
            lx += nums[-2]
            x = lx
            y += nums[-1]
        elif op == b"T*":
            newline()
        elif op in (b"Tj", b"'", b'"') and stack and isinstance(stack[-1], bytes):
            if op != b"Tj":
                newline()
            show([stack[-1]])
        elif op == b"TJ" and stack and isinstance(stack[-1], list):
            show(stack[-1])
        elif op == b"ET":
            pass                     # a text object ends; the next one decides by its own baseline
        stack = []
    newline()
    return lines


def pdf_text(pdf):
    objs = objects(pdf)
    font_maps = {}

    def font_map(num):
        if num in font_maps:
            return font_maps[num]
        head = objs.get(num, (b"", None))[0]
        m = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", head)
        tu = objs.get(int(m.group(1)), (b"", None))[1] if m else None
        d = re.search(rb"/DescendantFonts\s*\[\s*(\d+)\s+0\s+R", head)
        desc = objs.get(int(d.group(1)), (b"", None))[0] if d else b""
        font_maps[num] = Font(head, tu, desc)
        return font_maps[num]

    pages, annots = [], []
    for num in sorted(objs):
        head, _ = objs[num]
        if not re.search(rb"/Type\s*/Page\b(?!s)", head):
            continue
        fonts = {}
        fm = re.search(rb"/Font\s*<<(.*?)>>", head, re.S)
        if fm:
            for fname, fnum in re.findall(rb"/([^\s/]+)\s+(\d+)\s+0\s+R", fm.group(1)):
                fonts[fname] = font_map(int(fnum))
        contents = []
        cm = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)", head)
        if cm:
            contents = [int(x) for x in re.findall(rb"(\d+)\s+0\s+R", cm.group(1))]
        lines = []
        for c in contents:
            data = objs.get(c, (b"", None))[1] or b""
            lines += page_text(data, fonts)
        pages.append(lines)
    for head, _ in objs.values():
        for uri in re.findall(rb"/URI\s*\(((?:\\.|[^\\)])*)\)", head):
            annots.append(literal(uri).decode("latin-1"))
    return pages, annots


# ---------------------------------------------------------------- the build
def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        raise GateError(f"cannot load {url} ({e}). Start the demo server: python3 _tools/serve.py 4173")


def check_html(src, url):
    hits = [m.group(0) for m in PHONE.finditer(src)]
    if hits:
        raise GateError(f"{url}: the page source contains a phone-number pattern or tel: link: {hits[:3]}")


def print_pdf(url, out):
    if not os.path.exists(CHROME):
        raise GateError(f"Google Chrome not found at {CHROME}")
    prof = tempfile.mkdtemp(prefix="build-pdf-prof-")
    try:
        cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               f"--user-data-dir={prof}", "--hide-scrollbars", "--no-pdf-header-footer",
               "--virtual-time-budget=8000", f"--print-to-pdf={out}", url]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0 or not out.exists() or out.stat().st_size < 1000:
            raise GateError(f"Chrome did not print the PDF (exit {r.returncode}):\n{r.stderr[-800:]}")
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def check_pdf(path):
    pdf = path.read_bytes()
    if not pdf.startswith(b"%PDF-"):
        raise GateError(f"{path} is not a PDF")
    pages, uris = pdf_text(pdf)
    text = "\n".join("\n".join(p) for p in pages)
    flat = re.sub(r"\s+", " ", text)
    tight = re.sub(r"\s+", "", text)
    # the phone check first, on the text as laid out, on one line, with no spaces at all, and on link targets
    for t in (text, flat, tight, " ".join(uris)):
        m = PHONE.search(t)
        if m:
            raise GateError(f"the PDF contains a phone-number pattern or tel: link: {m.group(0)!r}")
    if b"(tel:" in pdf.lower():
        raise GateError("the PDF contains a tel: link")
    missing = [w for w in MUST_FIND if w.lower() not in tight.lower()]
    if missing:
        raise GateError(f"text extraction could not find {missing}: the PDF's text cannot be verified, refusing")
    return len(pages), flat


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--text", action="store_true", help="also print the extracted text (QA)")
    a = ap.parse_args()
    out = pathlib.Path(a.out).resolve()
    try:
        check_html(fetch(a.url), a.url)
        with tempfile.TemporaryDirectory(prefix="build-pdf-") as tmp:
            tmp_pdf = pathlib.Path(tmp) / "resume.pdf"
            print_pdf(a.url, tmp_pdf)
            n, flat = check_pdf(tmp_pdf)
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(tmp_pdf), str(out))
    except GateError as e:
        print(f"build-pdf: FAILED — {e}", file=sys.stderr)
        sys.exit(1)
    print(f"build-pdf: wrote {out} ({out.stat().st_size // 1024} KB, {n} page{'s' if n != 1 else ''}); "
          f"no phone number in the page source or the PDF text")
    if n > 2:
        print("build-pdf: warning: more than two pages; the résumé should print on two (check the print CSS)", file=sys.stderr)
    if a.text:
        print(flat)


if __name__ == "__main__":
    main()

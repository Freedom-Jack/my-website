#!/usr/bin/env python3
"""Compliance sweep for the design demo (QA only, stdlib). Exit 1 on any failure.

    python3 design-demo/tools/qa/compliance.py

Enforces Jack's hard rules on every shipped file under design-demo/ (skips _studies/, _notes/, tools/qa/):
  - no phone-number patterns and no tel: links (Jack decided 2026-10-09: the phone stays off the site and PDF)
  - no street address or Canadian postal code
  - no 'PMP' / 'Project Management Professional'
  - the old phone-number PDF (QijinXu_Resume.pdf) is never named or linked; the only PDF link is /resume.pdf
  - no CJK character other than the seal glyph, and never the forbidden four-character motto
    (checked by code point, so this file never contains it)
  - every application/ld+json block parses; resume.json parses
  - raster images: only the allow-listed photo, as a JPEG with no EXIF/XMP metadata, and the footer story map's ten
    scene stills (tools/build-stills.py): exactly those WebP files, no metadata chunks, each <= 16 KB and <= 60 KB
    together, and in the pages only as decorative <img alt=""> inside the story map's aria-hidden art
  - resume.pdf exists and has at most 2 pages (its phone gate is tools/build-pdf.py, which prints it from
    /resume/; this script also checks that page's source)
Markdown files (COPY.md, README.md, SPEC-*.md, DESIGN.md) state the rules in words, so their findings are
reported but do not fail the run.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]          # design-demo/
SKIP_DIRS = {"_studies", "_notes"}
SEAL = chr(0x5F90)                                   # the seal glyph (built from its code point)
MOTTO = "".join(map(chr, (0x77E5, 0x884C, 0x5408, 0x4E00)))   # the forbidden motto, by code point
_CJK_RANGES = [(0x2E80, 0x2FDF), (0x3000, 0x303F), (0x3040, 0x30FF), (0x3100, 0x312F), (0x3190, 0x31FF),
               (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xA960, 0xA97F), (0xAC00, 0xD7AF), (0xF900, 0xFAFF),
               (0xFE30, 0xFE4F), (0xFF00, 0xFFEF), (0x20000, 0x3FFFF)]
CJK = re.compile("[" + "".join(f"{chr(a)}-{chr(b)}" for a, b in _CJK_RANGES) + "]")
PHONE = re.compile(r"(?<![\w.#-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w-])")
TEL = re.compile(r"tel:", re.I)
STREET = re.compile(r"\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St\.|Avenue|Ave\.?|Road|Rd\.|Boulevard|Blvd|"
                    r"Drive|Dr\.|Lane|Ln\.|Crescent|Cres\.?|Court|Ct\.|Parkway|Terrace|Circle)\b")
POSTAL = re.compile(r"(?<![#\w])[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b")
PMP = re.compile(r"\bPMP\b|Project Management Professional", re.I)
OLD_PDF = re.compile(r"QijinXu_Resume", re.I)
PDF_HREF = re.compile(r"""href\s*=\s*["']([^"']+\.pdf)(?:[?#][^"']*)?["']""", re.I)
LDJSON = re.compile(r"""<script[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>""", re.I | re.S)
TEXT = {".html", ".css", ".js", ".mjs", ".svg", ".json", ".txt", ".xml", ".md", ".py", ".swift"}
RASTER = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".tif", ".tiff", ".heic", ".ico"}
ALLOWED_RASTER = {"assets/img/qijin-xu-colour.jpg"}
# the footer story map's scene stills (tools/build-stills.py): decorative, exact files, capped
SCENE_STILLS = {f"assets/img/scenes/{p}@{d}x.webp" for p in ("home", "work", "writing", "resume", "contact") for d in (1, 2)}
SCENE_CAP, SCENE_CAP_TOTAL = 16 * 1024, 60 * 1024
SCENE_REF = re.compile(r"/assets/img/scenes/")
IMG_TAG = re.compile(r"<img\b[^>]*>", re.I | re.S)
STORY_ART = re.compile(r'<div class="story-map__art" aria-hidden="true">(.*?)</div>', re.S)
ALLOWED_PDF_HREF = {"/resume.pdf", "https://my-website-freedomjack.vercel.app/resume.pdf", "https://qijinxu.com/resume.pdf"}

fails, notes = [], []


def files():
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS or rel.parts[:2] == ("tools", "qa") or p.name == ".DS_Store":
            continue
        yield p, rel.as_posix()


def report(md, msg):
    (notes if md else fails).append(msg)


def jpeg_has_metadata(data):
    i = 2
    while i + 4 <= len(data) and data[i] == 0xFF:
        marker = data[i + 1]
        if marker == 0xDA:
            break
        seg_len = int.from_bytes(data[i + 2:i + 4], "big")
        body = data[i + 4:i + 10]
        if marker == 0xE1 and (body.startswith(b"Exif") or body.startswith(b"http:")):
            return True
        if marker == 0xED:   # Photoshop/IPTC
            return True
        i += 2 + seg_len
    return False


def webp_problem(data):
    """None for a plain WebP (RIFF/WEBP with image chunks only); else why not."""
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return "not a WebP file"
    i = 12
    while i + 8 <= len(data):
        tag, n = data[i:i + 4], int.from_bytes(data[i + 4:i + 8], "little")
        if tag in (b"EXIF", b"XMP ", b"ICCP"):
            return f"carries a {tag.decode().strip()} metadata chunk"
        i += 8 + n + (n & 1)
    return None


def scene_imgs(rel, text):
    """The story map's scene stills may appear only as <img alt=""> inside its aria-hidden art."""
    inside = set()
    for block in STORY_ART.finditer(text):
        for tag in IMG_TAG.finditer(block.group(1)):
            inside.add(block.start(1) + tag.start())
            if not re.search(r'\salt=""', tag.group(0)):
                fails.append(f"scene still without alt=\"\" in {rel}: {tag.group(0)[:100]}")
    for tag in IMG_TAG.finditer(text):
        if SCENE_REF.search(tag.group(0)) and tag.start() not in inside:
            fails.append(f"scene still outside the story map's aria-hidden art in {rel}: {tag.group(0)[:100]}")


def main():
    scene_bytes = 0
    for p, rel in files():
        ext = p.suffix.lower()
        if ext in RASTER:
            if rel in SCENE_STILLS:
                data = p.read_bytes()
                scene_bytes += len(data)
                why = webp_problem(data)
                if why:
                    fails.append(f"scene still {rel}: {why}")
                if len(data) > SCENE_CAP:
                    fails.append(f"scene still {rel} is {len(data)} bytes (cap {SCENE_CAP})")
                continue
            if rel not in ALLOWED_RASTER:
                fails.append(f"raster image not allow-listed: {rel}")
            elif ext in (".jpg", ".jpeg") and jpeg_has_metadata(p.read_bytes()):
                fails.append(f"photo carries EXIF/XMP/IPTC metadata: {rel}")
            continue
        if ext == ".pdf":
            if rel != "resume.pdf":
                fails.append(f"unexpected PDF: {rel}")
            continue
        if ext not in TEXT:
            continue
        text = p.read_text("utf-8", errors="replace")
        md = ext == ".md"
        for n, line in enumerate(text.splitlines(), 1):
            where = f"{rel}:{n}"
            if PHONE.search(line):
                report(md, f"phone-number pattern  {where}: {line.strip()[:120]}")
            if TEL.search(line) and ext != ".py":
                report(md, f"tel: link  {where}")
            if STREET.search(line) or POSTAL.search(line):
                report(md, f"street address / postal code  {where}: {line.strip()[:120]}")
            if PMP.search(line):
                report(md, f"PMP  {where}")
            if OLD_PDF.search(line):
                report(md, f"old PDF named  {where}")
            if MOTTO in line:
                report(md, f"forbidden motto  {where}")
            for ch in CJK.findall(line):
                if ch != SEAL:
                    report(md, f"CJK character other than the seal ({ch!r})  {where}")
        if ext == ".html":
            scene_imgs(rel, text)
            for href in PDF_HREF.findall(text):
                if href not in ALLOWED_PDF_HREF:
                    fails.append(f"PDF link other than /resume.pdf: {href}  ({rel})")
            for i, block in enumerate(LDJSON.findall(text), 1):
                try:
                    json.loads(block)
                except Exception as e:  # noqa: BLE001
                    fails.append(f"JSON-LD block {i} does not parse in {rel}: {e}")
    if scene_bytes > SCENE_CAP_TOTAL:
        fails.append(f"the scene stills weigh {scene_bytes} bytes together (cap {SCENE_CAP_TOTAL})")
    try:
        json.loads((ROOT / "resume.json").read_text("utf-8"))
    except Exception as e:  # noqa: BLE001
        fails.append(f"resume.json does not parse: {e}")
    pdf = ROOT / "resume.pdf"
    if not pdf.exists():
        fails.append("resume.pdf is missing (run tools/build-pdf.py with the demo server up)")
    else:
        pages = len(re.findall(rb"/Type\s*/Page(?!s)", pdf.read_bytes()))
        if pages == 0 or pages > 2:
            fails.append(f"resume.pdf has {pages} pages (expected 1-2)")

    for n in notes:
        print("note (rule text in markdown, not a failure):", n)
    for f in fails:
        print("FAIL:", f)
    if fails:
        print(f"compliance: FAIL ({len(fails)})")
        sys.exit(1)
    print("compliance: PASS (no phone, address, PMP, old PDF, stray CJK or motto; images allow-listed and clean; "
          "JSON-LD and resume.json parse; resume.pdf <= 2 pages)")


if __name__ == "__main__":
    main()

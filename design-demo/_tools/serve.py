#!/usr/bin/env python3
"""Demo-only static server: like `python3 -m http.server`, but unknown paths get the designed /404.html
(with a real 404 status), the way Vercel will serve it. No caching, so edits show up on reload.

usage: python3 _tools/serve.py [port=4173]   (run from design-demo/)
"""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                      ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".svg": "image/svg+xml",
                      ".webmanifest": "application/manifest+json"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.exists(page):
            body = open(page, "rb").read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

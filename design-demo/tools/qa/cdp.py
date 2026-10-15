#!/usr/bin/env python3
"""Tiny Chrome DevTools Protocol driver (stdlib only) for visual QA of the design demo.

Usage:  cdp.py steps.json        (or)   cdp.py - < steps.json   (or)   cdp.py '<inline json>'
Steps file = JSON list of actions, executed in order, in ONE real (not virtual-time) headless Chrome tab:
  {"viewport": [w, h, dpr=1, mobile=false]}       device metrics (true 390px works, touch emulated if mobile)
  {"reduced_motion": true}                          emulate prefers-reduced-motion: reduce
  {"media": "print"} / {"pdf": "/abs/out.pdf", "paper": "A4"}   emulate print CSS / render a PDF
  {"goto": "http://localhost:4173/work/"}           navigate and wait for load
  {"wait": 800}                                     sleep N ms (real time; CSS/JS animations run normally)
  {"scroll": 900}                                   window.scrollTo(0, y) then dispatch a wheel tick
  {"wheel": 600, "x": 700, "y": 450}                real mouse-wheel scroll by deltaY at (x, y)
  {"hover": "a.btn"} | {"hover": [x, y]}           move the mouse to an element centre or point
  {"click": "nav a[href='/work/']"} | {"click": [x, y]}   real mouse click (follows links -> page transition)
  {"key": "Tab"}                                    press a key (Tab, Enter, " ", Escape, Arrow*, PageUp/Down, Home, End)
  {"eval": "document.title"}                        run JS (awaits promises) and print the JSON result
  {"shot": "/abs/path/out.png"}                     viewport screenshot (PNG). NEVER save shots inside the repo.
  {"shot": "/abs/path/full.png", "full": true}      full-page screenshot
  {"burst": "/abs/path/prefix", "count": 6, "every": 120, "scale": 0.5}   timed screenshots (scale optional)
  {"console": true}                                 print console messages + JS exceptions collected so far
At the end, any JS exceptions are always printed.
Extra Chrome flags via env, e.g.  CDP_ARGS="--disable-3d-apis" cdp.py steps.json   (tests the no-WebGL fallback)
Note: "hover"/"click" with a selector first scrolls that element to the vertical centre of the viewport.
"""
import base64, json, os, socket, struct, subprocess, sys, tempfile, time, urllib.request, shutil

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
KEYS = {"Tab": 9, "Enter": 13, "Escape": 27, " ": 32, "PageUp": 33, "PageDown": 34, "End": 35, "Home": 36,
        "ArrowLeft": 37, "ArrowUp": 38, "ArrowRight": 39, "ArrowDown": 40}


class WS:
    def __init__(self, url):
        rest = url[len("ws://"):]
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.s.recv(4096)
            if not chunk:
                raise RuntimeError("websocket handshake failed")
            buf += chunk
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise RuntimeError("socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text):
        data = text.encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        hdr += mask
        self.s.sendall(bytes(hdr) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b""
        while True:
            b0, b1 = self._read(2)
            op, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            if b1 & 0x80:
                mask = self._read(4)
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(self._read(n)))
            else:
                payload = self._read(n)
            if op == 0x9:  # ping
                continue
            msg += payload
            if b0 & 0x80:
                return msg.decode("utf-8", "replace")


class Tab:
    def __init__(self, ws):
        self.ws, self.id, self.events = ws, 0, []

    def call(self, method, **params):
        self.id += 1
        my = self.id
        self.ws.send(json.dumps({"id": my, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == my:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})
            self.events.append(m)

    def wait_event(self, name, timeout=15):
        end = time.time() + timeout
        for i, e in enumerate(self.events):
            if e.get("method") == name:
                self.events.pop(i); return e
        self.ws.s.settimeout(0.5)
        try:
            while time.time() < end:
                try:
                    m = json.loads(self.ws.recv())
                except socket.timeout:
                    continue
                if m.get("method") == name:
                    return m
                self.events.append(m)
        finally:
            self.ws.s.settimeout(None)
        return None


def center(tab, sel):
    r = tab.call("Runtime.evaluate", expression=f"""(()=>{{const e=document.querySelector({json.dumps(sel)});
      if(!e) return null; e.scrollIntoView({{block:'center'}}); const b=e.getBoundingClientRect();
      return [b.left+b.width/2, b.top+b.height/2];}})()""", returnByValue=True)
    v = r.get("result", {}).get("value")
    if not v:
        raise RuntimeError(f"selector not found: {sel}")
    return v


def drain_console(tab):
    out, keep = [], []
    for e in tab.events:
        m = e.get("method")
        if m == "Runtime.consoleAPICalled":
            p = e["params"]
            out.append(f"[console.{p['type']}] " + " ".join(str(a.get('value', a.get('description', ''))) for a in p.get("args", [])))
        elif m == "Runtime.exceptionThrown":
            d = e["params"]["exceptionDetails"]
            out.append("[EXCEPTION] " + (d.get("exception", {}).get("description") or d.get("text", "")))
        elif m == "Log.entryAdded":
            en = e["params"]["entry"]
            out.append(f"[log.{en['level']}] {en.get('text','')} {en.get('url','')}")
        else:
            keep.append(e)
    tab.events = keep
    return out


def screenshot(tab, scale=None):
    kw = {"format": "png"}
    if scale and scale != 1:
        lm = tab.call("Page.getLayoutMetrics")["cssVisualViewport"]
        kw["clip"] = {"x": lm["pageX"], "y": lm["pageY"], "width": lm["clientWidth"], "height": lm["clientHeight"], "scale": scale}
    return base64.b64decode(tab.call("Page.captureScreenshot", **kw)["data"])


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "-"
    if arg == "-":
        steps = json.load(sys.stdin)
    elif os.path.exists(arg):
        steps = json.load(open(arg))
    else:
        steps = json.loads(arg)

    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    prof = tempfile.mkdtemp(prefix="cdp-prof-")
    proc = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={port}", f"--user-data-dir={prof}",
                             "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox",
                             "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
                             "--disable-extensions", "--disable-component-extensions-with-background-pages",
                             "--window-size=1440,900", *os.environ.get("CDP_ARGS", "").split(), "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        targets = None
        for _ in range(100):
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1))
                if any(t.get("type") == "page" for t in targets):
                    break
            except Exception:
                pass
            time.sleep(0.1)
        page = next(t for t in targets if t.get("type") == "page")
        tab = Tab(WS(page["webSocketDebuggerUrl"]))
        for d in ("Page.enable", "Runtime.enable", "Log.enable"):
            tab.call(d)
        tab.call("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
        mouse = [10, 10]
        for st in steps:
            if "viewport" in st:
                v = st["viewport"] + [1, False][len(st["viewport"]) - 2:]
                w, h, dpr, mob = v[0], v[1], v[2], v[3]
                tab.call("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=dpr, mobile=bool(mob))
                tab.call("Emulation.setTouchEmulationEnabled", enabled=bool(mob), maxTouchPoints=5 if mob else 1)
            elif "reduced_motion" in st:
                tab.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce" if st["reduced_motion"] else "no-preference"}])
            elif "media" in st:   # {"media": "print"} emulates print styles ({"media": ""} resets)
                tab.call("Emulation.setEmulatedMedia", media=st["media"])
            elif "pdf" in st:     # {"pdf": "/abs/out.pdf", "paper": "A4"|"Letter"}: Page.printToPDF
                w, h = (8.27, 11.69) if st.get("paper", "A4") == "A4" else (8.5, 11)
                data = tab.call("Page.printToPDF", paperWidth=w, paperHeight=h, preferCSSPageSize=True)["data"]
                open(st["pdf"], "wb").write(base64.b64decode(data)); print("[pdf]", st["pdf"])
            elif "goto" in st:
                tab.call("Page.navigate", url=st["goto"])
                tab.wait_event("Page.loadEventFired", 20)
            elif "wait" in st:
                time.sleep(st["wait"] / 1000)
            elif "scroll" in st:
                tab.call("Runtime.evaluate", expression=f"window.scrollTo({{top:{int(st['scroll'])},behavior:'instant'}})")
                tab.call("Input.dispatchMouseEvent", type="mouseWheel", x=mouse[0], y=mouse[1], deltaX=0, deltaY=0)
            elif "wheel" in st:
                x, y = st.get("x", 700), st.get("y", 450)
                tab.call("Input.dispatchMouseEvent", type="mouseWheel", x=x, y=y, deltaX=0, deltaY=st["wheel"])
            elif "hover" in st:
                x, y = center(tab, st["hover"]) if isinstance(st["hover"], str) else st["hover"]
                for i in range(6):   # glide in from the left so pointer-entry effects get a direction
                    tab.call("Input.dispatchMouseEvent", type="mouseMoved", x=x - 40 + i * 8, y=y)
                    time.sleep(0.016)
                mouse = [x, y]
            elif "click" in st:
                x, y = center(tab, st["click"]) if isinstance(st["click"], str) else st["click"]
                tab.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y)
                tab.call("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
                tab.call("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
                mouse = [x, y]
            elif "key" in st:
                k = st["key"]
                code = KEYS.get(k, 0)
                extra = {"text": "\r" if k == "Enter" else " "} if k in ("Enter", " ") else {}
                tab.call("Input.dispatchKeyEvent", type="keyDown", key=k, code="Space" if k == " " else k,
                         windowsVirtualKeyCode=code, nativeVirtualKeyCode=code, **extra)
                tab.call("Input.dispatchKeyEvent", type="keyUp", key=k, code="Space" if k == " " else k,
                         windowsVirtualKeyCode=code, nativeVirtualKeyCode=code)
            elif "eval" in st:
                r = tab.call("Runtime.evaluate", expression=st["eval"], returnByValue=True, awaitPromise=True)
                print("[eval]", json.dumps(r.get("result", {}).get("value", r.get("exceptionDetails", r)))[:4000])
            elif "shot" in st:
                kw = {"format": "png"}
                if st.get("full"):
                    kw["captureBeyondViewport"] = True
                    m = tab.call("Page.getLayoutMetrics")["cssContentSize"]
                    kw["clip"] = {"x": 0, "y": 0, "width": m["width"], "height": m["height"], "scale": 1}
                    data = base64.b64decode(tab.call("Page.captureScreenshot", **kw)["data"])
                else:
                    data = screenshot(tab, st.get("scale"))
                os.makedirs(os.path.dirname(st["shot"]), exist_ok=True)
                open(st["shot"], "wb").write(data)
                print("[shot]", st["shot"])
            elif "burst" in st:
                for i in range(st.get("count", 6)):
                    p = f"{st['burst']}-{i:02d}.png"
                    os.makedirs(os.path.dirname(p), exist_ok=True)
                    open(p, "wb").write(screenshot(tab, st.get("scale"))); print("[shot]", p)
                    time.sleep(st.get("every", 120) / 1000)
            elif "console" in st:
                for line in drain_console(tab):
                    print(line)
        for line in [l for l in drain_console(tab) if "EXCEPTION" in l or "console.error" in l or "log.error" in l]:
            print(line)
        print("[done]")
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except Exception:
            proc.kill()
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == "__main__":
    main()

// build-photo.swift — Home's colour photo, blended into the paper (SPEC-R4A §9.2, §13.7; brief-r4a §2).
//
//   swift -O tools/build-photo.swift <source.jpg> <out.jpg> [--crop x,y,w,h] [--size 720x900] [--sat .90]
//        [--warm .02] [--shadow-tint -.02,.01,.02] [--mid .03] [--wall-luma .62] [--wall-chroma .10]
//        [--lift auto|0.9] [--fade auto|off] [--fade-width .17] [--fade-neck .14] [--fade-edge 1]
//        [--quality .55] [--debug-mask mask.png] [--debug-fade fade.png]
//
//   The flags of the shipped file (assets/img/qijin-xu-colour.jpg), from public/images/selfie.jpg:
//     swift -O tools/build-photo.swift ../public/images/selfie.jpg assets/img/qijin-xu-colour.jpg
//   (the defaults below ARE the recipe; record any flag you change here, so the file stays reproducible).
//   A reshoot is a one-file swap: run the tool on the new source (with its own --crop), check its report.
//
// What it does, in order (macOS Core Image + ImageIO; no third-party code):
//   1. crop (x, y, w, h in source pixels, top-left origin; default x 240–2140, y 250–2625, 4:5), then Lanczos
//      to --size (default 720 × 900);
//   2. grade: saturation × --sat; warm the mid-tones a touch (R × (1 + warm), B × (1 − warm), weighted by
//      4L(1 − L)); shadows lean toward the painting's blue-green (below ~35 % luminance: R, G, B × (1 + tint));
//      +--mid mid-tone exposure to pay for the page's multiply blend;
//   3. FLATTEN, THEN LIFT THE WALL. The source wall is not flat (it greys toward the right, and a ceiling-corner
//      line crosses the top right), so a plain gain would leave a grey ghost edge once the page multiplies the
//      photo onto the paper.
//        a. wall mask: luminance > --wall-luma (0.62) and chroma (max − min channel) < --wall-chroma, eroded 8 px
//           away from the hair, skin, glasses and sweater, feathered ~12 px. The spec's first guess was chroma
//           < 0.06, but the selfie's wall has a warm cast (blue 10–18 levels below red and green), which drops
//           the ceiling band and the right-hand wall; skin and the sweater sit at 0.15 and above, so the default
//           is 0.10;
//        b. wall light: a heavy blur (σ ≈ 8 % of the width) of each channel inside the eroded mask, normalised by
//           the blurred mask and filled outward toward the wall's mean where there is no wall nearby;
//        c. divide by the wall light, then a knee (--lift: auto = low enough that 99.8 % of the wall maps to 255,
//           kept between 0.85 and 0.97) so the wall and the corner line between its planes map to 255; outside
//           the mask the same gain applies only through a soft shoulder (near-white, near-neutral pixels), so skin
//           highlights and the sweater keep their tone;
//        d. THE SHOULDER FADE, baked into the file (demo 4b; it replaces 4a's CSS mask, which Chrome's PDF dropped,
//           printing a hard rectangle with the whole sweater). The body dissolves into white along its own shoulder
//           line; white is the paper once the page multiplies the photo, exactly as a CSS mask to transparent
//           would be, so the fade also survives print, forced colours and any renderer. It is derived from the
//           wall mask, so a reshoot refits it:
//           - the body's top per column: the run of not-wall pixels that reaches the bottom edge. Where that run
//             stops below 55 % of the height it is a shoulder; where it climbs higher it is the neck (the longest
//             such run of columns);
//           - the dissolve's half-way line: on each shoulder, the shoulder's top plus a depth that grows from
//             "already gone" where the shoulder meets the frame's side (no cut sleeve) to --fade-neck beside the
//             neck (fast at first, t^0.7, so the shoulder keeps its line for most of its width); it only goes
//             down toward the neck (one bowl, no dent where the shoulder climbs into the neck); across the neck an
//             arch, deepest under the chin, as low as the frame allows; then smoothed (σ ≈ 18 px) into one curve;
//           - the dissolve: a smoothstep --fade-width tall around that line (--fade-edge times that where a
//             shoulder meets the frame's side), blurred σ ≈ 8 px, ending (< 1 % left) at the shoulder's top on the frame's sides
//             and at the bottom row. The face and neck are untouched; the report says where the fade starts.
//           --fade off reproduces 4a's file byte for byte (the steps before 3d are unchanged);
//   4. JPEG at --quality (ImageIO's scale; 0.55 by default, ~65 KB with the fade), sRGB (the ICC profile is kept), every APP1
//      (EXIF, XMP), APP13 (IPTC) and COM segment stripped. Target <= 80 KB.
// It prints the size in KB, the wall's minimum channel (>= 250 wanted), the corner-line step, the outer ring's
// colour difference against the paper as the page shows it (all four sides, multiplied; where it is wall and where
// the body meets the frame; ΔE ≤ 2 wanted), the fade's half-way line, and where the fade starts (the head must
// keep 1). Verify with `sips -g all` and `mdls`.
// The page then does the rest (components.css .hello__photo): mix-blend-mode multiply, so the white wall and the
// dissolved body become the paper exactly. No CSS mask, frame, radius, grey or vignette.

import CoreImage
import Foundation
import ImageIO

// ------------------------------------------------------------------ options
struct Options {
    var src = ""
    var out = ""
    var crop = (x: 240, y: 250, w: 1900, h: 2375)
    var size = (w: 720, h: 900)
    var sat: Float = 0.90
    var warm: Float = 0.02
    var tint: (Float, Float, Float) = (-0.02, 0.01, 0.02)
    var mid: Float = 0.03
    var wallLuma: Float = 0.62
    var wallChroma: Float = 0.10
    var lift: Float? = nil          // nil = auto
    var quality = 0.55            // ImageIO's scale: 0.55 here is ~70 KB at 720 × 900 (the spec's "~0.75" is libjpeg's)
    var fade = true               // 3d: the shoulder fade, baked in (--fade off leaves the body whole: comparisons only)
    var fadeWidth: Float = 0.17   // the dissolve's height beside the neck, as a fraction of the frame's height
    var fadeNeck: Float = 0.14    // how far below the shoulder's top the dissolve is half done, beside the neck (fraction)
    var fadeEdge: Float = 1.00    // the dissolve's height where a shoulder meets the frame's side, relative to --fade-width
    var debugMask: String? = nil
    var debugFade: String? = nil
}

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(1)
}

func parse() -> Options {
    var o = Options()
    var args = Array(CommandLine.arguments.dropFirst())
    var pos: [String] = []
    func nums(_ s: String, _ n: Int, _ sep: Character = ",") -> [Double] {
        let v = s.split(separator: sep).compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        if v.count != n { fail("expected \(n) numbers in \(s)") }
        return v
    }
    while !args.isEmpty {
        let a = args.removeFirst()
        func val() -> String { if args.isEmpty { fail("\(a) needs a value") }; return args.removeFirst() }
        switch a {
        case "--crop": let v = nums(val(), 4); o.crop = (Int(v[0]), Int(v[1]), Int(v[2]), Int(v[3]))
        case "--size": let v = nums(val(), 2, "x"); o.size = (Int(v[0]), Int(v[1]))
        case "--sat": o.sat = Float(nums(val(), 1)[0])
        case "--warm": o.warm = Float(nums(val(), 1)[0])
        case "--shadow-tint": let v = nums(val(), 3); o.tint = (Float(v[0]), Float(v[1]), Float(v[2]))
        case "--mid": o.mid = Float(nums(val(), 1)[0])
        case "--wall-luma": o.wallLuma = Float(nums(val(), 1)[0])
        case "--wall-chroma": o.wallChroma = Float(nums(val(), 1)[0])
        case "--lift": let v = val(); o.lift = v == "auto" ? nil : Float(nums(v, 1)[0])
        case "--quality": o.quality = nums(val(), 1)[0]
        case "--fade": let v = val(); if v != "auto" && v != "off" { fail("--fade takes auto or off") }; o.fade = v == "auto"
        case "--fade-width": o.fadeWidth = Float(nums(val(), 1)[0])
        case "--fade-neck": o.fadeNeck = Float(nums(val(), 1)[0])
        case "--fade-edge": o.fadeEdge = Float(nums(val(), 1)[0])
        case "--debug-mask": o.debugMask = val()
        case "--debug-fade": o.debugFade = val()
        case "-h", "--help": print("usage: swift -O tools/build-photo.swift <source.jpg> <out.jpg> [flags] (see the header)"); exit(0)
        default:
            if a.hasPrefix("--") { fail("unknown flag \(a)") }
            pos.append(a)
        }
    }
    if pos.count != 2 { fail("usage: swift -O tools/build-photo.swift <source.jpg> <out.jpg> [flags]") }
    o.src = pos[0]
    o.out = pos[1]
    return o
}

// ------------------------------------------------------------------ pixels
let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

/// Load, crop and Lanczos-resize; returns interleaved RGBA8 (top row first).
func loadPixels(_ o: Options) -> [UInt8] {
    let url = URL(fileURLWithPath: o.src)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let full = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fail("cannot read \(o.src)") }
    let rect = CGRect(x: o.crop.x, y: o.crop.y, width: o.crop.w, height: o.crop.h)
    guard rect.maxX <= CGFloat(full.width), rect.maxY <= CGFloat(full.height),
          let cropped = full.cropping(to: rect) else { fail("the crop \(rect) is outside the \(full.width)x\(full.height) source") }
    let sx = Double(o.size.w) / Double(o.crop.w)
    let sy = Double(o.size.h) / Double(o.crop.h)
    let ci = CIImage(cgImage: cropped)
    guard let lanczos = CIFilter(name: "CILanczosScaleTransform") else { fail("no Lanczos filter") }
    lanczos.setValue(ci, forKey: kCIInputImageKey)
    lanczos.setValue(sx, forKey: kCIInputScaleKey)
    lanczos.setValue(sy / sx, forKey: kCIInputAspectRatioKey)
    let ctx = CIContext(options: [.outputColorSpace: sRGB])
    guard let scaled = lanczos.outputImage,
          let cg = ctx.createCGImage(scaled, from: CGRect(x: 0, y: 0, width: o.size.w, height: o.size.h), format: .RGBA8, colorSpace: sRGB)
    else { fail("resize failed") }
    var buf = [UInt8](repeating: 0, count: o.size.w * o.size.h * 4)
    buf.withUnsafeMutableBytes { raw in
        let bc = CGContext(data: raw.baseAddress, width: o.size.w, height: o.size.h, bitsPerComponent: 8,
                           bytesPerRow: o.size.w * 4, space: sRGB, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        bc.draw(cg, in: CGRect(x: 0, y: 0, width: o.size.w, height: o.size.h))
    }
    return buf
}

@inline(__always) func smooth(_ e0: Float, _ e1: Float, _ x: Float) -> Float {
    let t = min(1, max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
}
@inline(__always) func luma(_ r: Float, _ g: Float, _ b: Float) -> Float { 0.2126 * r + 0.7152 * g + 0.0722 * b }

/// Separable box blur of one channel (clamp to edge), `passes` times: ~Gaussian with σ ≈ sqrt(((2r+1)² − 1) / 4 · passes / 3).
func boxBlur(_ src: [Float], _ w: Int, _ h: Int, radius r: Int, passes: Int = 3) -> [Float] {
    if r < 1 { return src }
    var a = src
    var b = [Float](repeating: 0, count: w * h)
    let norm = 1 / Float(2 * r + 1)
    for _ in 0..<passes {
        // rows
        a.withUnsafeBufferPointer { s in b.withUnsafeMutableBufferPointer { d in
            for y in 0..<h {
                let row = y * w
                var acc: Float = 0
                for k in -r...r { acc += s[row + min(w - 1, max(0, k))] }
                for x in 0..<w {
                    d[row + x] = acc * norm
                    acc += s[row + min(w - 1, x + r + 1)] - s[row + max(0, x - r)]
                }
            }
        } }
        // columns
        b.withUnsafeBufferPointer { s in a.withUnsafeMutableBufferPointer { d in
            for x in 0..<w {
                var acc: Float = 0
                for k in -r...r { acc += s[min(h - 1, max(0, k)) * w + x] }
                for y in 0..<h {
                    d[y * w + x] = acc * norm
                    acc += s[min(h - 1, y + r + 1) * w + x] - s[max(0, y - r) * w + x]
                }
            }
        } }
    }
    return a
}

/// Binary erosion by a (2r+1)² square, through a summed-area table.
func erode(_ m: [Bool], _ w: Int, _ h: Int, radius r: Int) -> [Bool] {
    var sat = [Int32](repeating: 0, count: (w + 1) * (h + 1))
    for y in 0..<h {
        var run: Int32 = 0
        for x in 0..<w {
            run += m[y * w + x] ? 1 : 0
            sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + run
        }
    }
    let full = Int32((2 * r + 1) * (2 * r + 1))
    var out = [Bool](repeating: false, count: w * h)
    for y in r..<(h - r) {
        for x in r..<(w - r) {
            let x0 = x - r, y0 = y - r, x1 = x + r + 1, y1 = y + r + 1
            let s = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0]
            out[y * w + x] = s == full
        }
    }
    // the image border is wall where the wall reaches it: let the eroded mask run out to the edge
    for y in 0..<h {
        for x in 0..<w where x < r || x >= w - r || y < r || y >= h - r {
            let cx = min(w - 1 - r, max(r, x)), cy = min(h - 1 - r, max(r, y))
            out[y * w + x] = out[cy * w + cx] && m[y * w + x]
        }
    }
    return out
}

// ------------------------------------------------------------------ colour difference (report only)
func toLab(_ r: Float, _ g: Float, _ b: Float) -> (Float, Float, Float) {
    func lin(_ c: Float) -> Float { c <= 0.04045 ? c / 12.92 : powf((c + 0.055) / 1.055, 2.4) }
    let R = lin(r), G = lin(g), B = lin(b)
    let X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
    let Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
    let Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
    func f(_ t: Float) -> Float { t > 0.008856 ? cbrtf(t) : 7.787 * t + 16 / 116 }
    return (116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)))
}
func deltaE(_ a: (Float, Float, Float), _ b: (Float, Float, Float)) -> Float {
    sqrtf((a.0 - b.0) * (a.0 - b.0) + (a.1 - b.1) * (a.1 - b.1) + (a.2 - b.2) * (a.2 - b.2))
}

// ------------------------------------------------------------------ JPEG out, metadata stripped
func encodeJPEG(_ px: [UInt8], _ w: Int, _ h: Int, quality: Double) -> Data {
    var copy = px
    let cg: CGImage = copy.withUnsafeMutableBytes { raw in
        let bc = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                           space: sRGB, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        return bc.makeImage()!
    }
    let data = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(data as CFMutableData, "public.jpeg" as CFString, 1, nil) else { fail("no JPEG encoder") }
    CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    if !CGImageDestinationFinalize(dest) { fail("JPEG encoding failed") }
    return strip(data as Data)
}

/// Keep SOI, APP0 (JFIF), APP2 ICC_PROFILE and every non-APP segment; drop APP1 (EXIF/XMP), APP3–15, COM.
func strip(_ d: Data) -> Data {
    let b = [UInt8](d)
    guard b.count > 4, b[0] == 0xFF, b[1] == 0xD8 else { fail("not a JPEG") }
    var out: [UInt8] = [0xFF, 0xD8]
    var i = 2
    while i + 4 <= b.count {
        guard b[i] == 0xFF else { fail("JPEG segment parse error") }
        let marker = b[i + 1]
        if marker == 0xDA {                         // start of scan: the rest is image data
            out.append(contentsOf: b[i...])
            return Data(out)
        }
        let len = Int(b[i + 2]) << 8 | Int(b[i + 3])
        let seg = b[i..<(i + 2 + len)]
        let body = b[(i + 4)..<(i + 2 + len)]
        let isICC = marker == 0xE2 && body.starts(with: Array("ICC_PROFILE".utf8))
        let drop = marker == 0xFE || marker == 0xED || marker == 0xE1 || (marker >= 0xE3 && marker <= 0xEF) || (marker == 0xE2 && !isICC)
        if !drop { out.append(contentsOf: seg) }
        i += 2 + len
    }
    fail("JPEG has no image data")
}

// ------------------------------------------------------------------ the recipe
let o = parse()
let W = o.size.w, H = o.size.h, N = W * H
let px = loadPixels(o)
var R = [Float](repeating: 0, count: N), G = R, B = R
for i in 0..<N {
    R[i] = Float(px[i * 4]) / 255
    G[i] = Float(px[i * 4 + 1]) / 255
    B[i] = Float(px[i * 4 + 2]) / 255
}

// 2. grade
for i in 0..<N {
    var r = R[i], g = G[i], b = B[i]
    var L = luma(r, g, b)
    r = L + (r - L) * o.sat; g = L + (g - L) * o.sat; b = L + (b - L) * o.sat
    let m = 4 * L * (1 - L)
    r *= 1 + o.warm * m; b *= 1 - o.warm * m
    L = luma(r, g, b)
    let s = 1 - smooth(0.20, 0.35, L)
    r *= 1 + o.tint.0 * s; g *= 1 + o.tint.1 * s; b *= 1 + o.tint.2 * s
    r += 4 * o.mid * r * (1 - r); g += 4 * o.mid * g * (1 - g); b += 4 * o.mid * b * (1 - b)
    R[i] = min(1, max(0, r)); G[i] = min(1, max(0, g)); B[i] = min(1, max(0, b))
}

// 3a. the wall mask (from the graded pixels)
var wall = [Bool](repeating: false, count: N)
for i in 0..<N {
    let mx = max(R[i], G[i], B[i]), mn = min(R[i], G[i], B[i])
    wall[i] = luma(R[i], G[i], B[i]) > o.wallLuma && (mx - mn) < o.wallChroma
}
let eroded = erode(wall, W, H, radius: 8)
let Me = eroded.map { $0 ? Float(1) : 0 }
let Mf = boxBlur(Me, W, H, radius: 4)                   // feathered: a ~12 px ramp
var wallCount = 0
var mean: (Float, Float, Float) = (0, 0, 0)
for i in 0..<N where eroded[i] { mean.0 += R[i]; mean.1 += G[i]; mean.2 += B[i]; wallCount += 1 }
if wallCount < N / 50 { fail("found almost no wall (\(wallCount) px): is this the right source and crop?") }
mean = (mean.0 / Float(wallCount), mean.1 / Float(wallCount), mean.2 / Float(wallCount))

// 3b. the wall light: normalised convolution with a heavy blur, filled outward toward the wall's mean
let sigma = 0.08 * Float(W)
let rBig = max(1, Int((sqrtf(4 * sigma * sigma + 1) - 1) / 2))
let wsum = boxBlur(Me, W, H, radius: rBig)
let eps: Float = 0.02
func light(_ c: [Float], _ m: Float) -> [Float] {
    let blurred = boxBlur(zip(c, Me).map { $0 * $1 }, W, H, radius: rBig)
    return (0..<N).map { (blurred[$0] + eps * m) / (wsum[$0] + eps) }
}
let LR = light(R, mean.0), LG = light(G, mean.1), LB = light(B, mean.2)

// 3c. divide, knee, and the soft shoulder outside the mask
var vals: [Float] = []
vals.reserveCapacity(wallCount)
for i in 0..<N where eroded[i] { vals.append(min(R[i] / LR[i], G[i] / LG[i], B[i] / LB[i])) }
vals.sort()
let pct = { (p: Float) -> Float in vals[min(vals.count - 1, Int(Float(vals.count) * p))] }
let knee = o.lift ?? min(0.97, max(0.85, pct(0.002) * 0.995))
var lifted = [UInt8](repeating: 255, count: N * 4)
for i in 0..<N {
    let gr = 1 / (LR[i] * knee), gg = 1 / (LG[i] * knee), gb = 1 / (LB[i] * knee)
    let r = R[i], g = G[i], b = B[i]
    let Lw = luma(LR[i], LG[i], LB[i])
    let chroma = max(r, g, b) - min(r, g, b)
    let shoulder = smooth(0.80, 0.97, luma(r, g, b) / Lw) * (1 - smooth(0.06, 0.12, chroma))
    let k = max(Mf[i], shoulder)
    lifted[i * 4] = UInt8(min(255, max(0, (r * (1 + (gr - 1) * k)) * 255 + 0.5)))
    lifted[i * 4 + 1] = UInt8(min(255, max(0, (g * (1 + (gg - 1) * k)) * 255 + 0.5)))
    lifted[i * 4 + 2] = UInt8(min(255, max(0, (b * (1 + (gb - 1) * k)) * 255 + 0.5)))
}

// 3d. the shoulder fade, from the wall mask (so a reshoot refits it): see the header
var fadeA = [Float](repeating: 1, count: N)
var neckSpan = (l: 0, r: -1)
var lineB = [Float](repeating: Float(H), count: W)          // the dissolve's half-way line, per column
var shoulderLine = [Float](repeating: Float(H), count: W)
if o.fade {
    let F = o.fadeWidth * Float(H)
    let soft = 8                                            // the last blur, sigma ~ 8 px
    let reach: Float = 0.45                                 // "ended": 0.45 of the dissolve past its half-way line (< 1 % left)
    // a. the body's top in each column: the run of subject pixels (not wall) that reaches the bottom edge
    var top = [Int](repeating: H, count: W)                 // H: no body in this column
    for x in 0..<W {
        var y = H - 1
        while y >= 0 && Mf[y * W + x] < 0.5 { y -= 1 }
        top[x] = y + 1
    }
    let headRun = Int(0.55 * Float(H))                      // a run that climbs above this is the neck and head
    var best = (l: 0, r: -1), runL = -1
    for x in 0...W {
        let neck = x < W && top[x] < headRun
        if neck && runL < 0 { runL = x }
        if !neck && runL >= 0 { if x - 1 - runL > best.r - best.l { best = (runL, x - 1) }; runL = -1 }
    }
    if best.r < best.l { best = (W * 2 / 5, W * 3 / 5) }   // no neck found: arch under the middle fifth
    neckSpan = best
    // the shoulder line on each side, smoothed (a column with no body, or a stray run, takes its neighbour's line)
    var line = top.map { Float($0) }
    func side(_ xs: [Int]) {                                // xs runs from the neck outward
        var last = Float(H) - F / 2
        for x in xs { if top[x] < H && top[x] >= headRun { last = Float(top[x]) }; line[x] = last }
        let vals = boxBlur(xs.map { line[$0] }, xs.count, 1, radius: 12, passes: 2)
        for (k, x) in xs.enumerated() { line[x] = vals[k] }
    }
    if best.l > 0 { side(Array((0..<best.l).reversed())) }
    if best.r < W - 1 { side(Array((best.r + 1)..<W)) }
    shoulderLine = line
    // b. along each shoulder the half-way line sits a depth below the shoulder's top: from "already gone" where the
    //    shoulder meets the frame's side (the dissolve ends at the shoulder's top there, so no cut sleeve) to
    //    --fade-neck beside the neck; the dissolve itself narrows from --fade-width to --fade-edge of it at the side.
    //    The depth grows quickly from the side (t^0.7), so the shoulder keeps its line for most of its width.
    let dNeck = o.fadeNeck * Float(H)
    var Fx = [Float](repeating: F, count: W)
    for x in 0..<W where x < best.l || x > best.r {
        let t = x < best.l ? Float(x) / Float(max(1, best.l)) : Float(W - 1 - x) / Float(max(1, W - 1 - best.r))
        let s = smooth(0, 1, powf(t, 0.7))
        Fx[x] = F * (o.fadeEdge + (1 - o.fadeEdge) * s)
        let dEdge = -reach * Fx[x] - Float(soft)
        lineB[x] = line[x] + dEdge + (dNeck - dEdge) * s
    }
    let floorX = Fx.map { Float(H) - 1 - reach * $0 }      // the lowest line that still ends at the bottom row
    // one bowl, never a dent: from each side toward the neck the line only goes down (where the shoulder climbs
    // steeply into the neck it would otherwise turn back up)
    if best.l > 1 { for x in 1..<best.l { lineB[x] = min(floorX[x], max(lineB[x], lineB[x - 1])) } }
    if best.r < W - 2 { for x in stride(from: W - 2, to: best.r, by: -1) { lineB[x] = min(floorX[x], max(lineB[x], lineB[x + 1])) } }
    // across the neck: an arch from one shoulder's line to the other's, deepest under the chin (at the floor)
    let bl = best.l > 0 ? lineB[best.l - 1] : floorX[best.l], br = best.r < W - 1 ? lineB[best.r + 1] : floorX[best.r]
    for x in best.l...best.r {
        let t = (Float(x - best.l) + 0.5) / Float(best.r - best.l + 1)
        let base = bl + (br - bl) * smooth(0, 1, t)
        let s = sinf(Float.pi * t)
        lineB[x] = base + (floorX[x] - base) * s * s
    }
    lineB = boxBlur((0..<W).map { min(lineB[$0], floorX[$0]) }, W, 1, radius: 18, passes: 3)   // sigma ~ 18: one smooth curve
    lineB = (0..<W).map { min(lineB[$0], floorX[$0]) }
    Fx = boxBlur(Fx, W, 1, radius: 8, passes: 2)
    // c. the dissolve (a smoothstep across Fx around the line), softened, then blended toward white: white is the
    //    paper once the page multiplies the photo, exactly as a CSS mask to transparent would be
    for y in 0..<H { for x in 0..<W { fadeA[y * W + x] = 1 - smooth(lineB[x] - Fx[x] / 2, lineB[x] + Fx[x] / 2, Float(y)) } }
    fadeA = boxBlur(fadeA, W, H, radius: soft)
    for i in 0..<N where fadeA[i] < 1 {
        for c in 0..<3 { lifted[i * 4 + c] = UInt8(min(255, max(0, 255 - fadeA[i] * (255 - Float(lifted[i * 4 + c])) + 0.5))) }
    }
}

// 4. encode, strip, write
let jpeg = encodeJPEG(lifted, W, H, quality: o.quality)
do { try jpeg.write(to: URL(fileURLWithPath: o.out)) } catch { fail("cannot write \(o.out): \(error)") }

// report: measured on the JPEG as it ships (decoded again), inside the full-strength wall mask (8 px clear of
// anything that is not wall), 2 px clear of the frame's edge
guard let shipSrc = CGImageSourceCreateWithData(jpeg as CFData, nil),
      let shipImg = CGImageSourceCreateImageAtIndex(shipSrc, 0, nil) else { fail("cannot re-read the JPEG") }
var ship = [UInt8](repeating: 0, count: N * 4)
ship.withUnsafeMutableBytes { raw in
    CGContext(data: raw.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: sRGB,
              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!.draw(shipImg, in: CGRect(x: 0, y: 0, width: W, height: H))
}
var wallVals: [Int] = []
var step = 0
for y in 2..<(H - 2) {
    for x in 2..<(W - 2) where Mf[y * W + x] >= 0.98 {
        let i = (y * W + x) * 4
        wallVals.append(min(Int(ship[i]), Int(ship[i + 1]), Int(ship[i + 2])))
        // the corner line crosses the top right, clear of the hair: the largest step between vertical neighbours
        if y < H * 3 / 10 && x >= W * 82 / 100 && Mf[(y - 1) * W + x] >= 0.98 {
            for c in 0..<3 { step = max(step, abs(Int(ship[i + c]) - Int(ship[i - W * 4 + c]))) }
        }
    }
}
wallVals.sort()
let wallMin = wallVals.first ?? 255
let wallP = wallVals.isEmpty ? 255 : wallVals[wallVals.count / 1000]
let out = ship
// the outer 4 px ring (all four sides) as the page shows it: the file multiplied onto the paper (#EFF1EE), with
// no mask (the fade is in the file), against the paper
let paper: (Float, Float, Float) = (239 / 255, 241 / 255, 238 / 255)
let paperLab = toLab(paper.0, paper.1, paper.2)
// The ring is reported where it is wall (the frame's edge must vanish there) and, separately, where the body
// meets the frame (the sweater at the lower sides and the bottom, which the shoulder fade must have dissolved).
var dE: Float = 0, dEmax: Float = 0, ringN = 0, bodyE: Float = 0, bodyMax: Float = 0, bodyN = 0
for y in 0..<H {
    for x in 0..<W where y < 4 || y >= H - 4 || x < 4 || x >= W - 4 {
        let i = (y * W + x) * 4
        let seen = { (c: UInt8) -> Float in Float(c) / 255 }
        let lab = toLab(paper.0 * seen(out[i]), paper.1 * seen(out[i + 1]), paper.2 * seen(out[i + 2]))
        let d = deltaE(lab, paperLab)
        if Mf[y * W + x] >= 0.5 { dE += d; dEmax = max(dEmax, d); ringN += 1 } else { bodyE += d; bodyMax = max(bodyMax, d); bodyN += 1 }
    }
}
// the fade must leave the face and neck alone: the highest row it reaches (alpha < 0.98) across the neck, and
// the strongest it gets on the face (the subject above the shoulder line's highest point)
var reachNeck = H, reachMid = H, faceMin: Float = 1
let shoulderTop = (0..<W).filter { $0 < neckSpan.l || $0 > neckSpan.r }.map { shoulderLine[$0] }.min() ?? Float(H)
for x in max(0, neckSpan.l)...max(0, neckSpan.r) {
    for y in 0..<H where fadeA[y * W + x] < 0.98 { reachNeck = min(reachNeck, y); break }
}
let midX = (max(0, neckSpan.l) + max(0, neckSpan.r)) / 2
for y in 0..<H where fadeA[y * W + midX] < 0.98 { reachMid = y; break }
for y in 0..<min(H, Int(shoulderTop)) { for x in 0..<W where Mf[y * W + x] < 0.5 { faceMin = min(faceMin, fadeA[y * W + x]) } }
func writeGrey(_ v: [Float], _ path: String) {
    var m = [UInt8](repeating: 0, count: N * 4)
    for i in 0..<N { let g = UInt8(min(255, max(0, v[i] * 255))); m[i * 4] = g; m[i * 4 + 1] = g; m[i * 4 + 2] = g; m[i * 4 + 3] = 255 }
    let bc = m.withUnsafeMutableBytes { CGContext(data: $0.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                                                   space: sRGB, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!.makeImage()! }
    if let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil) {
        CGImageDestinationAddImage(d, bc, nil); CGImageDestinationFinalize(d)
    }
}
if let path = o.debugMask { writeGrey(Mf, path) }
if let path = o.debugFade { writeGrey(fadeA, path) }
print(String(format: "build-photo: %@ %dx%d, %.1f KB (target <= 80), quality %.2f", o.out, W, H, Double(jpeg.count) / 1024, o.quality))
print(String(format: "  wall: %.1f%% of the frame; light %.3f–%.3f; after the divide p0.2 %.3f · p1 %.3f · p5 %.3f; knee %.3f",
             100 * Float(wallCount) / Float(N), LR.min()!, LR.max()!, pct(0.002), pct(0.01), pct(0.05), knee))
print(String(format: "  shipped wall: minimum channel %d, 0.1th percentile %d (>= 250 wanted; the few below are stray hair tips)", wallMin, wallP))
print(String(format: "  corner line: largest step %d/255 (<= 2 wanted); the frame's edge on paper, where it is wall: mean ΔE %.2f, max %.2f (<= 2 wanted)",
             step, dE / Float(max(1, ringN)), dEmax))
print(String(format: "  where the body meets the frame (%.0f%% of the ring, %@): mean ΔE %.2f, max %.2f (<= 2 wanted)",
             100 * Float(bodyN) / Float(max(1, ringN + bodyN)), o.fade ? "dissolved by the shoulder fade" : "NO FADE: --fade off",
             bodyE / Float(max(1, bodyN)), bodyMax))
if o.fade {
    let f = { (x: Int) -> Float in lineB[min(W - 1, max(0, x))] / Float(H) }
    print(String(format: "  shoulder fade: neck x %d–%d; half-way line (fraction of the height) edge %.3f · junctions %.3f, %.3f · centre %.3f · edge %.3f",
                 neckSpan.l, neckSpan.r, f(0), f(neckSpan.l - 1), f(neckSpan.r + 1), f((neckSpan.l + neckSpan.r) / 2), f(W - 1)))
    print(String(format: "  face and neck: across the neck the fade starts at %.3f of the height (%.3f under the chin); above the shoulders' highest point (%.3f) the head keeps >= %.3f (1 wanted)",
                 Float(reachNeck) / Float(H), Float(reachMid) / Float(H), shoulderTop / Float(H), faceMin))
}
if Double(jpeg.count) > 80 * 1024 { print("  WARNING: over 80 KB: lower --quality") }
if wallP < 250 { print("  WARNING: the wall is not white enough: try a lower --lift (e.g. 0.9)") }

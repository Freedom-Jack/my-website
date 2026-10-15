// build-photo.swift — Home's colour photo, blended into the paper (SPEC-R4A §9.2, §13.7; brief-r4a §2).
//
//   swift -O tools/build-photo.swift <source.jpg> <out.jpg> [--crop x,y,w,h] [--size 720x900] [--sat .90]
//        [--warm .02] [--shadow-tint -.02,.01,.02] [--mid .03] [--wall-luma .62] [--wall-chroma .10]
//        [--lift auto|0.9] [--quality .75] [--debug-mask mask.png]
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
//   4. JPEG at --quality (ImageIO's scale; 0.55 by default, ~70 KB), sRGB (the ICC profile is kept), every APP1
//      (EXIF, XMP), APP13 (IPTC) and COM segment stripped. Target <= 80 KB.
// It prints the size in KB, the wall's minimum channel (>= 250 wanted), the corner-line step, and the outer ring's
// colour difference against the paper as the page shows it (multiplied, with the shoulder fade; ΔE ≤ 2 wanted).
// Verify with `sips -g all` and `mdls`.
// The page then does the rest (components.css .hello__photo): mix-blend-mode multiply (the white wall becomes the
// paper exactly) and a mask fade at the shoulders (bottom 83 % → 100 %, an 8 % side feather that only the
// sweater reaches). No frame, radius, grey or vignette.

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
    var debugMask: String? = nil
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
        case "--debug-mask": o.debugMask = val()
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
// the outer 4 px ring (top, left, right) as the page shows it: multiplied onto the paper (#EFF1EE), through the
// shoulder fade (components.css: opaque to 83 % of the height, transparent at 100 %; the sides' 8 % feather
// is left out here, so the figure is a conservative bound), against the paper
let paper: (Float, Float, Float) = (239 / 255, 241 / 255, 238 / 255)
let paperLab = toLab(paper.0, paper.1, paper.2)
// The ring is reported where it is wall (the frame's edge must vanish there) and, separately, where the body
// meets the frame (the sweater at the lower sides, which the page fades out toward the bottom).
var dE: Float = 0, dEmax: Float = 0, ringN = 0, bodyE: Float = 0, bodyN = 0
for y in 0..<H {
    let alpha = 1 - min(1, max(0, (Float(y) / Float(H - 1) - 0.83) / 0.17))
    for x in 0..<W where y < 4 || x < 4 || x >= W - 4 {
        let i = (y * W + x) * 4
        let seen = { (c: UInt8) -> Float in 1 - alpha + alpha * Float(c) / 255 }
        let lab = toLab(paper.0 * seen(out[i]), paper.1 * seen(out[i + 1]), paper.2 * seen(out[i + 2]))
        let d = deltaE(lab, paperLab)
        if Mf[y * W + x] >= 0.5 { dE += d; dEmax = max(dEmax, d); ringN += 1 } else { bodyE += d; bodyN += 1 }
    }
}
if let path = o.debugMask {
    var m = [UInt8](repeating: 0, count: N * 4)
    for i in 0..<N { let v = UInt8(min(255, Mf[i] * 255)); m[i * 4] = v; m[i * 4 + 1] = v; m[i * 4 + 2] = v; m[i * 4 + 3] = 255 }
    let bc = m.withUnsafeMutableBytes { CGContext(data: $0.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                                                   space: sRGB, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!.makeImage()! }
    if let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil) {
        CGImageDestinationAddImage(d, bc, nil); CGImageDestinationFinalize(d)
    }
}
print(String(format: "build-photo: %@ %dx%d, %.1f KB (target <= 80), quality %.2f", o.out, W, H, Double(jpeg.count) / 1024, o.quality))
print(String(format: "  wall: %.1f%% of the frame; light %.3f–%.3f; after the divide p0.2 %.3f · p1 %.3f · p5 %.3f; knee %.3f",
             100 * Float(wallCount) / Float(N), LR.min()!, LR.max()!, pct(0.002), pct(0.01), pct(0.05), knee))
print(String(format: "  shipped wall: minimum channel %d, 0.1th percentile %d (>= 250 wanted; the few below are stray hair tips)", wallMin, wallP))
print(String(format: "  corner line: largest step %d/255 (<= 2 wanted); the frame's edge on paper, where it is wall: mean ΔE %.2f, max %.2f (<= 2 wanted)",
             step, dE / Float(max(1, ringN)), dEmax))
print(String(format: "  where the body meets the frame (%.0f%% of the ring, faded by the page toward the bottom): mean ΔE %.1f",
             100 * Float(bodyN) / Float(max(1, ringN + bodyN)), bodyE / Float(max(1, bodyN))))
if Double(jpeg.count) > 80 * 1024 { print("  WARNING: over 80 KB: lower --quality") }
if wallP < 250 { print("  WARNING: the wall is not white enough: try a lower --lift (e.g. 0.9)") }

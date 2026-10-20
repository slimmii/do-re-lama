// Maakt de app-iconen (public/icons/) uit de pixel-lama. Opnieuw maken: swift tools/icons.swift
import AppKit

let src = NSImage(contentsOfFile: "public/img/lama/llama_base.png")!
let cg = src.cgImage(forProposedRect: nil, context: nil, hints: nil)!

// size: pixels; round: hoeken afronden (anders tot de rand, voor maskable/iOS); fill: hoe hoog de lama is (deel van het icoon)
func icon(_ name: String, _ size: Int, round: Bool, fill: CGFloat) {
  let s = CGFloat(size)
  let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  let rect = CGRect(x: 0, y: 0, width: s, height: s)
  if round { ctx.addPath(CGPath(roundedRect: rect, cornerWidth: s * 0.22, cornerHeight: s * 0.22, transform: nil)); ctx.clip() }
  let bg = CGGradient(colorsSpace: nil, colors: [CGColor(red: 0.33, green: 0.24, blue: 0.52, alpha: 1), CGColor(red: 0.114, green: 0.086, blue: 0.188, alpha: 1)] as CFArray, locations: [0, 1])!
  ctx.drawRadialGradient(bg, startCenter: CGPoint(x: s / 2, y: s * 0.55), startRadius: 0, endCenter: CGPoint(x: s / 2, y: s / 2), endRadius: s * 0.75, options: .drawsAfterEndLocation)
  let h = s * fill, w = h * CGFloat(cg.width) / CGFloat(cg.height)
  ctx.interpolationQuality = .none
  ctx.draw(cg, in: CGRect(x: (s - w) / 2, y: (s - h) / 2, width: w, height: h))
  let out = ctx.makeImage()!
  let rep = NSBitmapImageRep(cgImage: out)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "public/icons/\(name).png"))
}

try! FileManager.default.createDirectory(atPath: "public/icons", withIntermediateDirectories: true)
icon("icon-192", 192, round: true, fill: 0.74)
icon("icon-512", 512, round: true, fill: 0.74)
icon("maskable-512", 512, round: false, fill: 0.56)
icon("apple-touch-icon", 180, round: false, fill: 0.7)

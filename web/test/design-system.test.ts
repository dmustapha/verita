// Design-system checks. Machine-verified guards on the shipped visual system:
// token lint (:root matches the recorded palette), font lint (display=Fraunces, no generic
// defaults), computed WCAG contrast >=4.5:1, and brand.json <-> globals.css consistency.
// Run: `npm test`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(__dirname, "../app/globals.css");
const layoutPath = resolve(__dirname, "../app/layout.tsx");
const brandPath = resolve(__dirname, "../../brand.json");
const css = readFileSync(cssPath, "utf8");
const layout = readFileSync(layoutPath, "utf8");
const brand = JSON.parse(readFileSync(brandPath, "utf8"));

// --- parse :root custom properties ---
const root = css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{")));
function tok(name: string): string {
  const m = root.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`));
  if (!m) throw new Error(`token --${name} not found in :root`);
  return m[1].trim();
}

// --- canonical palette values (Petrol/Teal) ---
const TRUTH: Record<string, string> = {
  world: "#07100f", s1: "#0e1a19", s2: "#132322", s3: "#1a2e2c",
  text: "#e9f2f0", muted: "#8fa5a1", faint: "#70867f",
  amber: "#2dd4bf", copper: "#17b8a6",
  green: "#6bd08a", red: "#ff6a5f",
};

describe("token-drift lint (:root == shipped truth)", () => {
  for (const [k, v] of Object.entries(TRUTH)) {
    it(`--${k} is ${v}`, () => expect(tok(k).toLowerCase()).toBe(v));
  }
});

describe("forbidden-defaults lint", () => {
  it("display font is Fraunces (not Inter/Space Grotesk as display)", () => {
    expect(tok("serif").toLowerCase()).toContain("fraunces");
  });
  it("body font is Inter, mono is JetBrains Mono", () => {
    expect(tok("sans").toLowerCase()).toContain("inter");
    expect(tok("mono").toLowerCase()).toContain("jetbrains mono");
  });
  it("no Space Grotesk anywhere (generic AI default)", () => {
    expect(/space\s*grotesk/i.test(css) || /space\s*grotesk/i.test(layout)).toBe(false);
  });
  it("no Graphite-era orange/cream residue (brand is teal)", () => {
    for (const bad of ["232,161,60", "232, 161, 60", "232,200,150"]) {
      expect(css.includes(bad)).toBe(false);
    }
  });
  it("no off-token legacy red/green rgb (240,87,77 / 79,185,106)", () => {
    for (const bad of ["240,87,77", "79,185,106"]) expect(css.includes(bad)).toBe(false);
  });
  it("fonts are actually loaded in layout.tsx", () => {
    for (const f of ["Fraunces", "Inter", "JetBrains+Mono"]) expect(layout).toContain(f);
  });
});

// --- WCAG contrast ---
function hex(h: string) { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function lin(c: number) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function lum(h: string) { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
function ratio(a: string, b: string) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }

describe("computed contrast >= 4.5:1 (informational text on darkest surface)", () => {
  const world = tok("world"), s1 = tok("s1");
  const fg = ["text", "muted", "faint", "amber", "green", "red"];
  for (const name of fg) {
    it(`--${name} on --world`, () => expect(ratio(tok(name), world)).toBeGreaterThanOrEqual(4.5));
    it(`--${name} on --s1`, () => expect(ratio(tok(name), s1)).toBeGreaterThanOrEqual(4.5));
  }
  it("button ink (--world) on --amber", () => expect(ratio(tok("world"), tok("amber"))).toBeGreaterThanOrEqual(4.5));
});

describe("brand.json <-> globals.css consistency", () => {
  it("brandColor == --amber (the one accent hue)", () => expect(brand.brandColor.toLowerCase()).toBe(tok("amber")));
  it("semantic.success == --green, danger == --red", () => {
    expect(brand.semantic.success.toLowerCase()).toBe(tok("green"));
    expect(brand.semantic.danger.toLowerCase()).toBe(tok("red"));
  });
  it("ink ladder matches surfaces", () => {
    expect(brand.ink.map((x: string) => x.toLowerCase())).toEqual([tok("world"), tok("s1"), tok("s2"), tok("s3")]);
  });
  it("fonts match tokens", () => {
    expect(tok("serif").toLowerCase()).toContain(brand.fonts.display.toLowerCase());
    expect(tok("sans").toLowerCase()).toContain(brand.fonts.body.toLowerCase());
    expect(tok("mono").toLowerCase()).toContain(brand.fonts.mono.toLowerCase());
  });
  it("invariant phrase is present in the shipped hero", () => {
    const page = readFileSync(resolve(__dirname, "../app/page.tsx"), "utf8");
    // hero splits the phrase across an <em>; assert both halves are present
    expect(page.toLowerCase()).toContain("lie about a price");
    expect(page.toLowerCase()).toContain("lose your stake");
  });
});

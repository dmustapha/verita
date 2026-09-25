# Verita logo provenance

- **Mark:** the "Verdict V". The letter V of Verita rendered as a two-armed verdict: the left arm is a green upstroke (a mark VERIFIED / SAFE), the right arm is a red downstroke (a mark REFUSED / the stake SLASHED), meeting at a teal node that is the stake at risk. The mark encodes the product's one invariant, "lie about a price, lose your stake," and mirrors the console's signature state-flipping verdict card (teal/green SAFE to red REFUSED).
- **Palette:** verdict green `#6bd08a`, verdict red `#ff6a5f`, brand teal `#2dd4bf`, on petrol ink `#07100f`. Wordmark in Fraunces 600 `#e9f2f0`.

## Process (followed after the leash / alter-ego method)
1. Explored three concept directions on a board (`web/design/logo/logo-concepts.html`): A "Slashed stake" (a staked coin cut by the slash), B "Verdict V" (this mark), C "Sealed mark" (a stamped seal with a slashed corner).
2. Ran a second refinement round merging boldness with the V (`web/design/logo/refine-board.html`): R1 Seal-V, R2 Coin-V, R3 Bold V.
3. Selected concept B (Verdict V). It is the most ownable lettermark, ties directly to the name, and carries the SAFE/REFUSED duality without a container.
4. Hand-authored a clean, bold, 16px-legible inline vector (no thin outlines, no stock-checkmark geometry).

## Assets
- `app/icon.svg` (Next.js favicon), `public/logo.svg`, `public/favicon.svg`, `public/icon.svg`: the hand-authored Verdict V mark, transparent background, crisp at any scale.
- `public/logo.png` / `logo-512.png` / `logo-256.png` / `favicon-32.png`: transparent raster marks (browser, README, social).
- `public/apple-touch-icon.png`: the mark on a petrol rounded tile (iOS home screen, needs a filled square).
- `public/og-image.png` (1200x630): the lockup + tagline card for link previews (Open Graph / Twitter), wired in `app/layout.tsx` metadata.
- `public/logo-lockup.svg`: mark + Fraunces "Verita" wordmark.

## Retired
- `app/icon.svg` previously drew a thin single-weight outline checkmark inside a broken ring. It read as a generic stock "success" icon (no concept, no weight, no duality) and was replaced by the Verdict V (2026-09-25).
- `public/logo-v1.svg` / `logo-v2.svg` / `logo-v3.svg` are the earlier seal-and-broken-check studies, kept for reference only.

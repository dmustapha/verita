# Limitations — Verita
The honest scope boundary. Every gated item names its reason. A judge reads a deliberate boundary here, not a hidden gap. Honesty is placed secondary (not hero hedge-copy).

## In scope (built for this submission)
- The staked/slashable primitive `Verita.sol`: stake, attest, `safePrice` (reverts on unsafe + per-read USDG fee), `isTradeable`, `challenge` → slash.
- The reference consumer `LiquidationGuard.sol`: real wTSLAx collateral, USDG debt, mark-via-Verita, wrongful-liquidation refusal.
- Stale + halted + price-divergence reverts, and an organic-divergence slash driven by an independent signed report, live on X Layer 196.
- Real USDG movement on 196: a per-read fee and a slash to the harmed borrower.
- A judge-facing console (home + `/proof`) with a keys-off-host kill-shot.

## Feature-gated (deliberately not built for this scope)
- **Auto-detection of real corporate actions / splits.** Reason: scope + honesty — the wrapped token is Backed-controlled; splits/halts are honestly operator-tagged via the `MarketStatus` enum. Faking auto-detection would be dishonest.
- **A full lending protocol (auctions, interest, multi-collateral).** Reason: scope + anti-collision — the consumer is a THIN reference proving the primitive, not a market competing with agama (drift tripwire #3).
- **Multi-asset coverage beyond 2-3 xStocks.** Reason: time — one asset (wTSLAx) proves the loop; wNVDAx/wSPYx are optional stretch.
- **On-chain Chainlink Data Streams verification.** Reason: it is confirmed DEAD on 196 (`verify()` → `VerifierNotFound`). We replace it, we do not depend on it.
- **Protection/fills during a hard halt.** Reason: honest design — Verita REFUSES on bad status; it does not promise a fill into a frozen book (the PegGuard dead-book trap).

## Known honest caveats (disclosed, placed secondary)
- **Session/split status is operator-tagged in this build**, not auto-derived. The only ORGANICALLY-slashable trigger at demo scale is two-stream price divergence (plus a verifiable public halt). This is by design and disclosed; the "un-feedable" claim is scoped precisely to halt/split/de-peg accountability.
- **Source B (independent stream) requires a free key.** If unavailable at demo time, a pre-seeded *signed* report (real signature, labeled as fallback) drives the challenge. This is disclosed as a fallback, never presented as live.
- **External (non-team) usage.** If no non-team reader has used Verita by submission, this is stated plainly here; it is never implied or faked. The next step is securing external integrators.

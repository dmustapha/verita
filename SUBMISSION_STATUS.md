# Submission status — Verita
_Last updated: forge (Stage 2). build keeps this CURRENT as features land._

## Status
- [ ] Contracts compile + unit tests green (`forge test`) — F-001..F-009
- [ ] Verita + LiquidationGuard deployed on X Layer 196, OKLink-verified
- [ ] Seed script run: attester staked, REGULAR attestation live, one healthy borrower position
- [ ] Relayer attest loop live from an independent stream (Yahoo v8 verified)
- [ ] Organic-divergence slash proven on-chain (real USDG to the borrower) — HERO F-005
- [ ] Wrongful liquidation refused on a bad mark — HERO F-008
- [ ] `scripts/verify-claims.sh` green (headline numbers recompute from committed data) — F-011
- [ ] Console (home + /proof) live on a durable host with keys-off-host kill-shot — F-012
- [ ] ≥1 external non-team reader recorded on 196 — F-014 (or disclosed in LIMITATIONS)

## Known limitations / blockers
- Mainnet-196 funding (USDG + wTSLAx + OKB) is a CP3 Dami-spend blocker (DT-6) — cannot start on-chain proof until resolved.
- Source B independent stream needs a free key (DT-3); pre-seeded signed report is the disclosed fallback. Reason: free-tier API keys not yet provisioned.
- Split/session status is operator-tagged (auto-detection out of scope). Reason: scope + honesty.
- External non-team reader is an unverified future action until livetest confirms it. Reason: requires an external party before submission.

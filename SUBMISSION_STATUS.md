# Submission status — Verita
_Last updated: build (Stage 3) — code-complete + fork-verified; on-chain steps await funding. build keeps this CURRENT as features land._

## Status
- [x] Contracts compile + unit tests green (`forge test`) — F-001..F-009, F-015..F-018 (14/14; independent Gate ② APPROVE)
- [ ] Verita + LiquidationGuard deployed on X Layer 196, OKLink-verified — code ready (scripts compile); awaits funding
- [ ] Seed script run: attester staked, REGULAR attestation live, one healthy borrower position — code ready; awaits funding
- [~] Relayer attest loop live from an independent stream — relayer type-clean; **Yahoo v8 verified live (TSLA=381.005, F-013)**; live attest awaits funding
- [ ] Organic-divergence slash proven on-chain (real USDG to the borrower) — HERO F-005 — proven on fork; awaits funding for 196
- [x] Wrongful liquidation refused on a bad mark — HERO F-008 (green on fork; live re-check at livetest)
- [ ] `scripts/verify-claims.sh` green (headline numbers recompute from committed data) — F-011 — script ready; runs post-deploy
- [~] Console (home + /proof) live on a durable host with keys-off-host kill-shot — F-012 — **built feature-complete + next build ✓**; live reads + durable host await deploy
- [ ] ≥1 external non-team reader recorded on 196 — F-014 (try-else-disclose; Dami self-call does not qualify)

## Known limitations / blockers
- Mainnet-196 funding (USDG + wTSLAx + OKB) is a CP3 Dami-spend blocker (DT-6) — APPROVED; awaiting the actual transfer to the generated wallet set. Cannot complete on-chain proof until funds + OKLINK_API_KEY + SOURCE_B_KEY land.
- Source B independent stream needs a free key (DT-3); pre-seeded signed report is the disclosed fallback. Reason: free-tier API keys not yet provisioned.
- Split/session status is operator-tagged (auto-detection out of scope). Reason: scope + honesty.
- External non-team reader is an unverified future action until livetest confirms it. Reason: requires an external party before submission.

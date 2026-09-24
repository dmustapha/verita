# Submission status — Verita
_Last updated: build (Stage 3) — code-complete + fork-verified; on-chain steps await funding. build keeps this CURRENT as features land._

## Status
- [x] Contracts compile + unit tests green (`forge test`) — F-001..F-009, F-015..F-018 (14/14; independent Gate ② APPROVE)
- [x] Verita deployed on X Layer 196 (`0xF3d0E276…FA9176`, settlement token WOKB per AMEND-3) — OKLink source-verify deferred (optional, no key)
- [x] Attester (attacker) staked + divergent attestation live on 196
- [x] Live independent price stream — **Yahoo v8 + Finnhub both live ($377.94), F-013**; report signed by authorized REPORTER
- [x] **Organic-divergence slash proven on public 196 (real WOKB to the borrower) — HERO F-005** — tx `0x485a2f…8ae0c0`; borrower 0→0.005 WOKB; reason "price-divergence"; asset latched Diverged
- [x] Wrongful liquidation refused on a bad mark — HERO F-008 (green tests; fork-demonstrated — wTSLAx illiquid, disclosed)
- [x] `scripts/verify-claims.sh` green — F-011 — recomputes the slash from public 196 state (zero of our infra)
- [~] Console (home + /proof) — **built feature-complete + next build ✓**; live reads point at the mainnet Verita; durable host = deploy skill; keys-off-host kill-shot route built
- [ ] ≥1 external non-team reader recorded on 196 — F-014 (try-else-disclose; one-line command staged in submission/proof.md)

## Known limitations / blockers
- Mainnet-196 funding (USDG + wTSLAx + OKB) is a CP3 Dami-spend blocker (DT-6) — APPROVED; awaiting the actual transfer to the generated wallet set. Cannot complete on-chain proof until funds + OKLINK_API_KEY + SOURCE_B_KEY land.
- Source B independent stream needs a free key (DT-3); pre-seeded signed report is the disclosed fallback. Reason: free-tier API keys not yet provisioned.
- Split/session status is operator-tagged (auto-detection out of scope). Reason: scope + honesty.
- External non-team reader is an unverified future action until livetest confirms it. Reason: requires an external party before submission.

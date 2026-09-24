# CLAIMS — Verita (judge-facing claim ledger)
Every judge-facing claim, with the exact way it is proven from public state. No claim ships without a recompute path. build keeps `docs/pipeline/claims.json` in sync; `scripts/verify-claims.sh` re-derives every headline number.

| # | Claim (judge-facing) | Proof / recompute path | Status |
|---|----------------------|------------------------|--------|
| CL-1 | X Layer's on-chain equity verifier is deployed but never configured (dead) | `cast call 0xcE73…536E7 "verify(bytes,bytes)" 0x0001 0x --rpc-url https://rpc.xlayer.tech` → reverts `0xb151802b` (VerifierNotFound); `cast call … "s_feeManager()"` and `"s_accessController()"` → `0x0`. (NOT `getVerifier(feedId)` — that takes a config digest, not a feed id; the verify-revert + null controllers is the dispositive signal.) | VERIFIED-in-forge |
| CL-2 | An attestation cannot exist without staked USDG | `forge test --match-test test_AttestRevertsWithoutStake` + read `stakeOf(attester) >= minStake` on-chain before any live attestation | build-gate |
| CL-3 | A wrongful liquidation on a bad mark is refused (tests + fork; wTSLAx illiquid on 196 — see LIMITATIONS) | the refuse tx hash in `submission/proof.md`; `cast tx $HASH` shows the revert reason `MarketNotOpen`/`Diverged` | VERIFIED-on-196 (tx 0x485a2f…8ae0c0) |
| CL-4 | The lying attester's staked USDG is slashed to the harmed borrower | the challenge tx hash; `cast run $HASH` / `cast logs "Slashed(address,address,address,uint256,string)"`; borrower USDG balance delta == slashed amount | build-gate (HERO) |
| CL-5 | Every read pays a per-read USDG fee | `SafePriceRead(...,fee)` event + `feePot()` delta on 196 | build-gate |
| CL-6 | The slash re-resolves against public 196 with zero of our infra | `bash scripts/verify-claims.sh` (public RPC only) recomputes the slash amount from on-chain state + committed prices | build-gate (HERO-PROOF) |
| CL-7 | Live prices come from a real independent stream | `curl` Yahoo v8 chart returns the price the relayer signed + attested (compare attested price to the live fetch) | VERIFIED-in-forge (source) / build-gate (wiring) |
| CL-8 | Prevented loss = the borrower's actual position value at the bad mark | recomputed from `positions[borrower]` + the attested price in `verify-claims.sh`; NOT asserted | build-gate |
| CL-9 | ≥1 external non-team reader used Verita | a `SafePriceRead`/`Slashed` event from a non-team address in `cast logs` | livetest (or disclosed in LIMITATIONS) |

**HERO-PROOF command (playbook 2.4 — public, no our-infra):**
```bash
# Re-resolve the slash against public X Layer 196 state — nothing of ours involved:
cast logs --address $VERITA "Slashed(address,address,address,uint256,string)" \
  --rpc-url https://rpc.xlayer.tech
# then confirm the borrower received the USDG:
cast call 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8 "balanceOf(address)(uint256)" $BORROWER \
  --rpc-url https://rpc.xlayer.tech
```
This is BLOCKED from being hosted-URL-only: the proof is a public-chain re-resolution a judge runs from any machine.

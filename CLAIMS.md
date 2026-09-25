# CLAIMS: Verita (judge-facing claim ledger)
Every judge-facing claim, with the exact way it is proven from public state. No claim ships without a recompute path. build keeps `docs/pipeline/claims.json` in sync; `scripts/verify-claims.sh` re-derives every headline number.

| # | Claim (judge-facing) | Proof / recompute path | Status |
|---|----------------------|------------------------|--------|
| CL-1 | X Layer's on-chain equity verifier is deployed but never configured (dead) | `cast call 0xcE73…536E7 "verify(bytes,bytes)" 0x0001 0x --rpc-url https://rpc.xlayer.tech` → reverts `0xb151802b` (VerifierNotFound); `cast call … "s_feeManager()"` and `"s_accessController()"` → `0x0`. (NOT `getVerifier(feedId)`, that takes a config digest, not a feed id; the verify-revert + null controllers is the dispositive signal.) | VERIFIED-in-forge |
| CL-2 | An attestation cannot exist without staked USDG | `forge test --match-test test_AttestRevertsWithoutStake` + read `stakeOf(attester) >= minStake` on-chain before any live attestation | build-gate |
| CL-3 | A wrongful liquidation on a bad mark is refused | `forge test --match-test test_BorrowThenLiquidateRefusedOnHalt` + the mainnet-fork consumer run; the guard call reverts `MarketNotOpen` | VERIFIED via tests + mainnet-fork (wTSLAx has no retail liquidity on 196 → the consumer beat is fork-only, see LIMITATIONS; NOT the live price-divergence slash tx 0x485a2f…, which is CL-4) |
| CL-4 | The lying attester's stake is slashed to the harmed borrower (settlement token = WOKB on the live 196 proof, USDG in the designed-for suite, AMEND-3) | the challenge tx hash in `submission/proof.md` (0x485a2f…); `cast run $HASH` / `cast logs "Slashed(address,address,address,uint256,string)"`; borrower settlement-token balance delta == slashed amount | VERIFIED-on-196 (HERO) |
| CL-5 | Every read pays a per-read USDG fee | `SafePriceRead(...,fee)` event + `feePot()` delta on 196 | build-gate |
| CL-6 | The slash re-resolves against public 196 with zero of our infra | `bash scripts/verify-claims.sh` (public RPC only) recomputes the slash amount from on-chain state + committed prices | build-gate (HERO-PROOF) |
| CL-7 | Live prices come from a real independent stream | `curl` Yahoo v8 chart returns the price the relayer signed + attested (compare attested price to the live fetch) | VERIFIED-in-forge (source) / build-gate (wiring) |
| CL-8 | Prevented loss = the borrower's actual position value at the bad mark | recomputed from `positions[borrower]` + the attested price in `verify-claims.sh`; NOT asserted | build-gate |
| CL-9 | ≥1 external non-team reader used Verita | a `SafePriceRead`/`Slashed` event from a non-team address in `cast logs` | livetest (or disclosed in LIMITATIONS) |
| CL-10 | Verita slashes on a MARKET-STATUS contradiction (halt lied-about), not only on price divergence (CO-S1 / F-019) | the status-contradiction slash tx in `submission/proof.md`; `cast receipt $STATUS_SLASH_TX` status 1 + the `Slashed(...)` reason decodes to `status-contradiction` (attester REGULAR at true price, reporter HALTED at same price, zero price divergence) | build-gate (change-order v1.5) |
| CL-11 | A developer integrates in two calls against the live deployed Verita (CO-S2 / F-020) | the console dev strip renders `NEXT_PUBLIC_VERITA` == deployed `0xF3d0E276…FA9176`; the `isTradeable`/`safePrice` snippet matches `IVerita` (§ARCHITECTURE IVerita) | build-gate (change-order v1.5) |
| CL-12 | Each safety guarantee maps to a passing named forge test (CO-S3 / F-021) | `forge test --match-test "test_CannotDoubleLockAcrossAssets\|test_ChallengeRevertsFromNonReporter\|test_WithdrawAfterSlash\|test_BeneficiarySetOnce"` all pass; strip rows name their test ids (F-015/F-007/F-016/F-017) | build-gate (change-order v1.5) |
| CL-13 | Market status (enum) and the diverged latch are independent axes, legibly explained (CO-S4 / F-022) | the console renders a status-vs-diverged legend beside the registry status column | build-gate (change-order v1.5) |

**HERO-PROOF command (playbook 2.4, public, no our-infra):**
```bash
# Re-resolve the slash against public X Layer 196 state, nothing of ours involved:
cast logs --address $VERITA "Slashed(address,address,address,uint256,string)" \
  --rpc-url https://rpc.xlayer.tech
# then confirm the borrower received the slashed settlement token.
# DERIVE the token from the contract (do not hardcode; the live deploy settles WOKB, AMEND-3):
TOKEN=$(cast call $VERITA "USDG()(address)" --rpc-url https://rpc.xlayer.tech)
cast call $TOKEN "balanceOf(address)(uint256)" $BORROWER \
  --rpc-url https://rpc.xlayer.tech
```
This is BLOCKED from being hosted-URL-only: the proof is a public-chain re-resolution a judge runs from any machine.

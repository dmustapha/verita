# Verita feature certification

Every feature, the mechanism that enforces it, and the exact proof it works. Contract features are certified by a named `forge test` (run `forge test`, 32/32 pass). Live features are certified by a real transaction on public X Layer 196 (chainId 196), re-resolvable by anyone. Frontend features are certified by livetest against the deployed console.

Run it yourself:
```bash
forge test            # 32/32, keyless
cd web && npm test    # 35/35 design-system checks
bash scripts/verify-claims.sh   # recompute the live slash from public 196, zero setup
```

## 1. Attestation and staking

| Feature | Mechanism | Certified by | Status |
|---------|-----------|--------------|--------|
| No attestation without free staked collateral | `attest` requires `freeStake >= minStake` | `test_AttestRevertsWithoutStake` (InsufficientStake) | PASS |
| A single stake cannot back two assets | per-asset lock accounting | `test_CannotDoubleLockAcrossAssets` (StakeLocked) | PASS |
| Re-attesting an asset releases its old lock | lock released before re-lock | `test_ReAttestReleasesOldLock` | PASS |
| Locked stake cannot be withdrawn | `withdrawStake` checks `free = stake - locked` | `test_WithdrawStakeRevertsWhenLocked` (StakeLocked) | PASS |
| Free stake is withdrawable | free portion transfers out | `test_WithdrawFreeStakeSucceeds` | PASS |
| A slashed attester can still withdraw remaining free stake | no underflow-brick after slash | `test_WithdrawAfterSlash` | PASS |

## 2. Read safety (safePrice / isTradeable)

| Feature | Mechanism | Certified by | Status |
|---------|-----------|--------------|--------|
| Valid mark returns price and charges a per-read fee | `safePrice` returns + banks fee | `test_SafePriceReturnsAndChargesFee` | PASS |
| A halted mark is refused | status gate | `test_SafePriceRevertsHalted` (MarketNotOpen) | PASS |
| A stale mark is refused | `block.timestamp - ts > maxAge` | `test_SafePriceRevertsStale` (StaleAttestation) | PASS |
| A diverged mark is refused | latched `diverged` flag | `test_SafePriceRevertsWhenDiverged` (Diverged) | PASS |
| An un-attested asset is refused | attester zero check | `test_SafePriceRevertsNoAttestation` (NoAttestation) | PASS |
| `isTradeable` reflects freshness and status without a fee or revert | free view | `test_IsTradeableAcrossStates`, `test_IsTradeableFalseWhenHalted` | PASS |
| Per-read fees accumulate to the fee pot | `feePot` increment | `test_FeePotAccumulates` | PASS |

## 3. Slashing (challenge)

| Feature | Mechanism | Certified by | Status |
|---------|-----------|--------------|--------|
| Price divergence slashes the attester | `_diverges` beyond `divergenceBps` | `test_ChallengeSlashesOnOrganicDivergence` | PASS |
| Status contradiction slashes the attester (the market-status moat) | attested status != report status | `test_ChallengeSlashesOnStatusContradiction` | PASS |
| A mark within band is not slashable | `NoDivergence` guard | `test_ChallengeRevertsWithinBand` | PASS |
| Only an authorized reporter can slash | `reporters[signer]` check | `test_ChallengeRevertsFromNonReporter` (NotAReporter) | PASS |
| A report for the wrong asset is rejected | `report.asset == asset` check | `test_ChallengeRevertsBadReportAsset` (BadReportAsset) | PASS |
| A report cannot be replayed | `usedReports` guard | `test_ChallengeRevertsOnReplay` (ReportReplayed) | PASS |
| Challenging a non-existent attestation is rejected | attester zero check | `test_ChallengeRevertsNoAttestation` (NoAttestation) | PASS |
| A slash pays the registered beneficiary, not the challenger | `slashBeneficiary` payout | `test_RegisteredBeneficiaryReceivesSlash` | PASS |
| A beneficiary is set once and cannot be overwritten | set-once guard | `test_BeneficiarySetOnce` (BeneficiaryAlreadySet) | PASS |

## 4. Consumer (LiquidationGuard)

| Feature | Mechanism | Certified by | Status |
|---------|-----------|--------------|--------|
| Deposit, borrow, and repay adjust the position | position accounting | `test_DepositBorrowRepayFlow` | PASS |
| Borrowing beyond LTV is refused | `maxDebt` check | `test_BorrowRevertsUndercollateralized` (Undercollateralized) | PASS |
| Health factor is computed from the live mark | `maxDebt * 10000 / debt` | `test_HealthFactorBps` | PASS |
| A wrongful liquidation on a halted mark is refused | `safePrice` reverts in `liquidate` | `test_BorrowThenLiquidateRefusedOnHalt` (MarketNotOpen) | PASS |
| A healthy position cannot be liquidated | `Healthy` guard | `test_LiquidateHealthyReverts`, `test_HealthyPositionSafeFromLiquidation` | PASS |
| An underwater position is liquidated and collateral is seized | seize path | `test_LiquidateUnderwaterSeizes` | PASS |

## 5. Governance / config

| Feature | Mechanism | Certified by | Status |
|---------|-----------|--------------|--------|
| Only the owner can change reporters, fee, band, and max age | OpenZeppelin `Ownable` | `test_SettersRevertForNonOwner` (OwnableUnauthorizedAccount) | PASS |
| The owner can update config and it takes effect | setters | `test_OwnerUpdatesConfig` | PASS |

## 6. Live on public X Layer 196 (real value moved)

| Feature | Certified by (re-resolvable tx) | Status |
|---------|-------------------------------|--------|
| Contract deployed and configured | `0x75b89902976811758cdff54d65e10a5f051073669c9528200ea272d790a172a9` | PASS |
| Price-divergence slash moved real WOKB to the borrower | `0x485a2fd82d0e8ca9f0ed11edf7d8064d3a1bee77f3a090015bb958f9568ae0c0` | PASS |
| Status-contradiction slash (reason decodes `status-contradiction`) | `0x9a1ba59b9cf4b17fe7d8ec2a19b0352284ebcb53eb175c2383326c78fbcf6afc` | PASS |
| Kill-shot fires a real challenge from the deployed app | `0xa8834ee49e900cf56aac6cfbc7f84cba3a71959c68eda5b1e39c76de49ad6ee0` | PASS |
| The slash re-resolves keyless from public state | `bash scripts/verify-claims.sh` reproduces borrower balance + latched diverged | PASS |

## 7. Frontend surfaces (deployed console, livetest V1 PASS)

| Feature | Certified by | Status |
|---------|--------------|--------|
| Landing renders hero, Attested Registry, Stake/Slash Ledger, live guard from real 196 | livetest domain 1 | PASS |
| Kill-shot endpoint alive and fires (POST 200, GET 405) | livetest domain 2 | PASS |
| Zero first-party console errors | livetest domain 5 | PASS |
| Developer quickstart, guarantees, status-vs-diverged legend render live | livetest domain 8 | PASS |
| Cold-stranger hero: a fresh visitor can slash on the live app | livetest cold-stranger gate | PASS |

## Scope notes (honest)

- The live settlement token is WOKB, not USDG (USDG is dormant on X Layer with no retail liquidity). USDG is the designed-for token in the test suite and the fork consumer demo. See LIMITATIONS.md.
- The `LiquidationGuard` consumer read runs on tests plus a mainnet fork (wTSLAx has no retail liquidity on 196 to fund a live pool). The slash itself is live on 196.

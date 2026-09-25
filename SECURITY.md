# SECURITY, Verita

Threat model for the staked, slashable market-status settlement-integrity primitive and its reference consumer. Every row maps a real threat to the code that enforces the defense.

## Threat matrix

| Threat | Enforcement | File |
|---|---|---|
| Unbacked attestation (post a price with nothing at risk) | free-stake lock in `attest` (guarded write: after releasing this asset's prior lock, requires `stakeOf[msg.sender] - lockedOf[msg.sender] >= minStake`, `Verita.sol:100-101`; single writer of `attestations[asset]`) | `src/Verita.sol` |
| Forced / fake slash (trigger a slash without real divergence) | independent authorized signer recovery + on-chain divergence check (`> divergenceBps` or status contradiction) | `src/Verita.sol` (`challenge`) |
| Report replay (reuse a signed report) | `usedReports[asset,nonce]` guard, reverts `ReportReplayed()` | `src/Verita.sol` |
| Reentrancy on value moves | `ReentrancyGuard` on stake / fee / slash paths | `src/Verita.sol`, `src/LiquidationGuard.sol` |
| Wrongful liquidation on a bad mark | `liquidate` reads `verita.safePrice(collateral)` and bubbles its revert (`MarketNotOpen`/`StaleAttestation`/`Diverged`) | `src/LiquidationGuard.sol` |
| Anyone redirecting the slash payout | `registerBeneficiary` is SET-ONCE (reverts `BeneficiaryAlreadySet`) | `src/Verita.sol` (`registerBeneficiary`) |
| Cross-asset stake reuse (one stake backing two assets) | free-stake check in `attest` + per-(attester,asset) `lockedForAsset` ledger | `src/Verita.sol` (`attest` / `lockedForAsset`) |
| Fabricated/replayed kill-shot report | route fetches the LIVE independent price at click-time + signs a FRESH EIP-712 report; no pre-signed report is replayed; `challenge()` re-checks auth + real divergence on-chain (reverts `NoDivergence` if the mark is honest) | `web/app/api/killshot/route.ts` |
| Depending on the dead on-chain Chainlink verifier | price/status enter ONLY via authorized EIP-712 `ReporterReport`s; `scripts/verify-onchain.sh` asserts no VerifierProxy address in `src/` | `src/Verita.sol`, `scripts/verify-onchain.sh` |

## Not defended against

Naming what is out of scope is the honesty signal, not a gap:

- **Auto-detection of real halts / splits / corporate actions.** Market status is honestly operator-tagged via the `MarketStatus` enum; Verita does not claim to auto-detect a real NYSE halt or a stock split. Auto-detection is out of scope (disclosed in LIMITATIONS).
- **A colluding attester + reporter pair.** If the sole authorized reporter colludes with the attester, no divergence is reported. Mitigated only by reporter authorization (multi-reporter is the next step) + honesty disclosure; not cryptographically prevented.
- **Oracle-source manipulation upstream of the relayer.** If the independent price stream (Yahoo v8 / Finnhub) is itself manipulated at source, the signed report carries the bad number. Verita defends divergence between two streams, not corruption of both.
- **A deep-liquidity liquidation auction.** `LiquidationGuard` is a THIN reference consumer (no interest, no auction, no multi-collateral). It proves the refuse/consume path; it is not a production lending market.
- **Front-running the FIRST `registerBeneficiary` call for a brand-new asset.** Set-once binds whoever registers first. For the demo the consumer's constructor registers at deploy, so the window is a single deploy tx; for a new asset in production this is a documented setup step.
- **Demo signing/gas keys on the web host (keys-off-host kill-shot).** The one-click keys-off-host kill-shot inherently needs a server-side key. We minimize blast radius, not eliminate it: `RELAYER_PK` is a **small-funded gas key** (never a root/treasury key; controls only dust) and `REPORTER_PK` **only signs reports**, it cannot move funds (slashing pays the beneficiary and requires real on-chain divergence, so a leaked reporter key can at most trigger a *legitimate* slash). Both are server-only (never `NEXT_PUBLIC_`), gitignored, and no pre-signed report is stored. **Production hardening (DH-8, deploy-owned):** hold both keys on a separate relayer service that the web app calls over an authenticated HTTP endpoint, so the web deployment holds no keys at all; and set them as platform secrets (not a committed file), with the Vercel `.env.local`-clobber guard (move `.env.local` aside before any `vercel link/env`, keep ≥3 verified backups).

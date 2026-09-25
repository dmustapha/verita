# Verita, Domain Guide

Verita is a **staked / slashable safe-price + market-status primitive** for tokenized equities on X Layer (chain 196). This guide explains the domain concepts, the rules the system enforces, and how each concept maps to the code.

## Why this exists

A tokenized equity like **wTSLAx** is not a pure crypto asset, it tracks a real stock that can **halt**, **split**, or **de-peg**. Generic price feeds (Chainlink session-status v11) can report *session* state (pre / regular / post / overnight / closed) but they **cannot** feed the un-feedable slice: a mid-session trading **halt**, a pending **split**, or a **de-peg** of the wrapper. That un-feedable slice is exactly where naive lending protocols wrongfully liquidate borrowers. Verita makes an attester put money at risk to assert "this asset is safe to mark right now," and lets anyone slash that money with an independent signed report when the assertion is wrong.

## Core Concepts (≥10)

1. **Tokenized equity**, `wTSLAx` is a Backed-style wrapped, non-rebasing ERC-20 on chain 196 that tracks TSLA. It is held as *real* collateral by the reference consumer.
2. **Market status**, the trading session/condition of the underlying. Enum `MarketStatus { UNKNOWN, PRE, REGULAR, POST, OVERNIGHT, CLOSED, HALTED, SPLIT_PENDING, DEPEGGED }`. Feedable session set = `PRE, REGULAR, POST, OVERNIGHT`.
3. **Un-feedable slice (the moat)**, `HALTED`, `SPLIT_PENDING`, `DEPEGGED` (and `CLOSED`/`UNKNOWN`). These states are **not** present in any clean price feed, so a staked human/relayer attestation is the only source. This is Verita's reason to exist.
4. **Staked attestation**, an attester locks `minStake` USDG behind their assertion of `(price, status)` for one asset. No stake ⇒ no attestation (structurally impossible).
5. **Slash**, when an attestation is proven wrong, the attester's locked stake is confiscated and paid to the harmed beneficiary.
6. **Organic divergence**, the ONLY way a slash fires: an authorized independent reporter signs a report whose price is outside `divergenceBps` of the attested price (or whose status contradicts a tradeable claim). There is **no** owner/operator slash path.
7. **Per-read fee**, each `safePrice` consumer read charges `perReadFee` USDG into the `feePot`, funding the honest-attestation economy.
8. **safePrice refusal semantics**, `safePrice` is non-view: it **reverts** on no-attestation, staleness, non-tradeable status, or a proven divergence, instead of returning a wrong number.
9. **EIP-712 reporter report**, the independent report is EIP-712 typed data (`ReporterReport`), domain-bound to this contract + chainId 196. The struct hash **excludes** the `sig` field.
10. **Independent reporter key**, an off-chain key the owner authorizes via `setReporter`. Only reports recovering to an authorized signer can slash.
11. **Circuit breaker (`diverged` latch)**, once a valid challenge proves divergence, the asset's attestation latches `diverged = true` and every read reverts until it is re-attested.
12. **The dead VerifierProxy**, `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7` is a dead primitive Verita replaces. It must **never** appear in any call path in `src/`.

## Rules (invariants)

- **An attestation without stake is unrepresentable.** `attest`'s first gate is the free-stake check; `attest` is the only writer of `attestations[asset]`.
- **One stake cannot back two assets.** Free stake = `stakeOf − lockedOf`; each attest locks exactly `minStake` per `(attester, asset)`.
- **`safePrice` reverts on anything unsafe** rather than returning a stale/halted/divergent price.
- **A slash needs an independent signed report** from an authorized reporter proving price divergence or a status contradiction. A within-band matching report reverts `NoDivergence`, no theatre.
- **Beneficiary is set once**, the first `registerBeneficiary(asset, …)` binds; a second reverts `BeneficiaryAlreadySet`.
- **Never claim halt-protection from a feed.** Verita's value is the staked human attestation of the un-feedable slice, not a feed.

## Glossary: domain → code

| Domain term | Code symbol | Effect |
|---|---|---|
| halt | `MarketStatus.HALTED` | `safePrice` → `MarketNotOpen()` revert |
| split pending | `MarketStatus.SPLIT_PENDING` | `safePrice` → `MarketNotOpen()` revert |
| de-peg | `MarketStatus.DEPEGGED` | `safePrice` → `MarketNotOpen()` revert |
| market closed | `MarketStatus.CLOSED` | `safePrice` → `MarketNotOpen()` revert |
| tradeable session | `PRE / REGULAR / POST / OVERNIGHT` | `_tradeable()` true; `safePrice` returns price |
| stale mark | `block.timestamp − timestamp > maxAge` or `> expiry` | `StaleAttestation()` revert |
| no mark | `attester == address(0)` | `NoAttestation()` revert |
| proven wrong | `diverged == true` | `Diverged()` revert on read |
| staked attestation | `attest()` + `lockedForAsset[attester][asset] = minStake` | attestation stored |
| insufficient stake | `stakeOf − lockedOf < minStake` | `InsufficientStake()` revert |
| organic slash | `challenge()` with authorized signed divergent/contradicting report | `Slashed` event, stake → beneficiary |
| within-band report | `_diverges` false and no status contradiction | `NoDivergence()` revert (no slash) |
| unauthorized signer | `reporters[signer] == false` | `NotAReporter()` revert |
| replayed report | `usedReports[key] == true` | `ReportReplayed()` revert |
| per-read fee | `perReadFee` → `feePot` | `FeeCollected` event |
| beneficiary bound | `registerBeneficiary` (set-once) | `BeneficiaryAlreadySet()` on re-set |
| dead verifier | `0xcE73…536E7` | never referenced in `src/` |

Source: intel/domain.md §24/5 equities; WINNER-BRIEF §Thesis; ARCHITECTURE §11.

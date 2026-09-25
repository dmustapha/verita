# Builder Feedback, X Layer / OKX (Verita, OKX Dev Day 2026)

Real integration friction captured while building Verita directly against X Layer mainnet (chain 196),
OKX's DEX aggregator, Backed xStocks, Paxos USDG, and Chainlink Data Streams. Every item below is
falsifiable, it carries the exact address, error code, or command that reproduces it, plus a concrete fix.
This is not a wishlist; it is what actually cost build time on the stack.

## 1. Chainlink Data Streams on-chain `verify()` is dead on X Layer 196

- **What:** The Data Streams `VerifierProxy` at `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7` is deployed but
  never initialized. Any `verify(bytes,bytes)` call reverts `0xb151802b` (`VerifierNotFound`), and
  `s_feeManager()` / `s_accessController()` both return `0x0`.
- **Reproduce:**
  ```bash
  cast call 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7 "verify(bytes,bytes)" 0x0001 0x --rpc-url https://rpc.xlayer.tech
  # -> execution reverted, data: 0xb151802b  (VerifierNotFound)
  ```
- **Impact:** Any team designing on-chain equity-price verification on X Layer will build against a broken
  primitive and only discover it at integration time. We lost the first half-day confirming this is a
  chain-config gap, not our error. (It is the entire reason Verita ships its own staked attestation layer.)
- **Fix (for OKX/Chainlink):** Either initialize the VerifierProxy (feeManager + accessController + at least
  one verifier) on 196, or publish a one-line notice in the X Layer docs: "Chainlink Data Streams on-chain
  verify is not live on X Layer; use the off-chain REST endpoint." A single sentence saves every RWA builder
  a day.
- **Evidence in repo:** `scripts/verify-onchain.sh` asserts this revert as a source-lock; `DOMAIN-GUIDE.md`.

## 2. OKX DEX aggregator API is trial-plan-walled for programmatic swaps

- **What:** Attempting to acquire USDG or wTSLAx programmatically via the OKX DEX aggregator API returns
  error code `50114` (plan/quota wall) without a funded paid plan. There is no free tier sufficient to
  script a single mainnet swap for a demo.
- **Impact:** A hackathon builder cannot script "OKB → USDG" to fund a demo wallet. We had to reframe the
  live settlement token from USDG to WOKB (wrapped OKB), because USDG could not be obtained on-chain at all
  (see item 3). This is a real barrier to "build a market" demos that need the ecosystem's own stablecoin.
- **Fix (for OKX):** Provide a small free/sandbox quota on the DEX aggregator (e.g. N calls/day) or a
  documented faucet/OTC path for USDG on X Layer during hackathons. The aggregator being the *only* swap
  path AND being pay-walled blocks the exact flows the tracks ask for.

## 3. USDG and xStocks are on-chain-dormant on 196 (no retail liquidity)

- **What:** USDG (`0x4ae46a509F6b1D9056937BA4500cb143933D2dc8`, Paxos, self-described ~1.51B and "idle") and
  the Backed xStocks (wTSLAx `0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171`, wNVDAx
  `0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5`) have live bytecode and correct `symbol()`s, but no public
  AMM pool and effectively zero retail transfer activity over tens of thousands of recent blocks. xStocks
  are mint-on-deposit, issuer-KYC'd wrappers, a permissionless builder cannot obtain a test balance.
- **Reproduce:** `cast call 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171 "symbol()(string)" --rpc-url https://rpc.xlayer.tech`
  returns `wTSLAx`, but there is no swap route to acquire it and `balanceOf` for non-issuer addresses is 0.
- **Impact:** The "tokenized stocks & RWA" track's headline assets cannot be held by a builder for a live
  demo. We proved Verita's slash on WOKB (real value moving) and demonstrated the wTSLAx-collateral consumer
  on a mainnet fork + full test suite, disclosing the split honestly.
- **Fix (for OKX/Backed/Paxos):** A hackathon-scoped faucet or a small seeded AMM pool for USDG + one or two
  xStocks on 196 would let teams demonstrate the exact RWA flows the track rewards, on mainnet, with real
  assets, instead of forking or substituting.

## 4. OKLink contract verification friction

- **What:** Source verification on OKLink (the X Layer explorer) for 196 requires an API key path that is
  not surfaced in the primary X Layer quickstart, and the standard `forge verify-contract --verifier etherscan`
  flow needs a non-obvious `--verifier-url` for OKLink. Time-to-first-verified-contract is high.
- **Impact:** Judges who click a contract address expect verified source; the default deploy path does not
  produce it, and the fix is undocumented in the main flow.
- **Fix (for OKX/OKLink):** Add a copy-paste `forge verify-contract` example with the exact OKLink
  `--verifier-url` and key-provisioning link to the X Layer "deploy your first contract" doc.

---

### Method note
Items 1–3 are load-bearing: each one changed Verita's architecture or demo scope, and each is reproducible
from a public RPC with the command shown. Item 4 is a developer-experience cost, not a design blocker.
No vague filler is included by design, an unfalsifiable complaint costs credibility with judges.

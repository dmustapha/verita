# Judges: the 2-minute path

Verita is a staked, slashable price-and-market-status oracle for tokenized stocks on X Layer. Lie about a price or a market halt, lose your stake to the borrower the lie would have harmed. Everything below is live on public X Layer 196 and re-resolvable with none of our infrastructure in the path.

## 1. See it live (30s)
- **Console:** https://verita-xlayer.vercel.app, the wSPYx position is green/SAFE, a real staked mark on X Layer.
- **Proof page:** https://verita-xlayer.vercel.app/proof, every transaction below, with OKLink links.

## 2. The money moment (the kill-shot)
An attester posted a mark that diverged from an independent signed report. The contract caught it and slashed the whole stake to the borrower.
- Slash (price-divergence): [`0xa4eae8bf…dac0e2c`](https://www.oklink.com/xlayer/tx/0xa4eae8bf8917715f25db1127ff82a0c54681d93a3d47c747c2aaccbf6dac0e2c)

## 3. The moat (the lie no price feed catches)
An authorized halt reporter contradicted an attester who kept quoting a halted NVIDIA position as trading normally. Same price, opposite truth about market status. Slashed.
- Slash (status-contradiction): [`0x9a1ba59b…fbcf6afc`](https://www.oklink.com/xlayer/tx/0x9a1ba59b9cf4b17fe7d8ec2a19b0352284ebcb53eb175c2383326c78fbcf6afc)

## 4. Run it yourself (no build, no keys)
Reads state straight from the chain. `isTradeable` is a free view; `safePrice` charges a per-read fee, so use the free view to verify:
```
cast call 0xF3d0E2768F43062b532b3d4bb63c155238FA9176 \
  "isTradeable(address)(bool)" 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540 \
  --rpc-url https://rpc.xlayer.tech
# -> true   (matches the green console)
```

## 5. Clone and test (60s)
```
git clone https://github.com/dmustapha/verita && cd verita
forge test          # 32/32, keyless
bash scripts/verify-claims.sh   # re-resolves the slashes from public 196
```

## 6. Integrate it (two calls)
```solidity
require(verita.isTradeable(asset), "unsafe");   // free view: false on stale/halted/split/diverged
uint256 price = verita.safePrice(asset);        // reverts on unsafe input; charges a per-read fee
```
A stale, halted, or divergent mark reverts the read, so a consumer refuses to act on a bad price automatically.

## Honest scope
- **Settlement token** on the live proof is **WOKB** (USDG is dormant on X Layer with no retail liquidity; USDG remains the designed-for token in the test suite and fork consumer). See [LIMITATIONS.md](LIMITATIONS.md).
- The **wrongful-liquidation-refuse** consumer (`LiquidationGuard`) is proven in the test suite and on a mainnet fork, not as a live 196 UI (wTSLAx is illiquid on 196). The live hero is the **slash arc** above.
- The halt reporter is a **trusted halt oracle** (same trust model as the price demo); the attester lied about market state, not a faked halt.

## Contracts (X Layer 196)
| Contract | Address |
|---|---|
| Verita | `0xF3d0E2768F43062b532b3d4bb63c155238FA9176` |
| wSPYx (hero asset) | `0xE7E553Cd128F0011777323A0b44a7b96EA1CB540` |
| Dead Chainlink verifier Verita replaces | `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7` |

Full transaction ledger: [submission/proof.md](submission/proof.md) · claims: [CLAIMS.md](CLAIMS.md)

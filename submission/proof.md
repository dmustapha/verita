# On-Chain Proof — Verita (X Layer mainnet, chain 196)

The organic-divergence slash, proven on **public** X Layer mainnet. Settlement token for the live proof is **WOKB** (`0xe538905cf8410324e03A5A23C1c177a474D59b2b`) — see LIMITATIONS (USDG is dormant on X Layer / no retail liquidity; USDG remains the designed-for token used in the test suite + fork consumer demo).

## Deployed
| Contract | Address | Explorer |
|----------|---------|----------|
| Verita | `0xF3d0E2768F43062b532b3d4bb63c155238FA9176` | https://www.oklink.com/x-layer/address/0xF3d0E2768F43062b532b3d4bb63c155238FA9176 |

Config: settlement token WOKB · `minStake` 0.005 WOKB · `perReadFee` 0.0005 WOKB · `divergenceBps` 50 (0.5%) · `maxAge` 300s · reporter `0x2454A6AFeE37c4dA93A9B1FC7BEb972C811D4189` (authorized) · slash beneficiary = BORROWER `0x184a985e244BB070D4F58872B742896fdcc46a98`.

## The HERO flow — every tx on public 196
| Step | What | Tx hash |
|------|------|---------|
| Deploy | Verita(WOKB) + setReporter + registerBeneficiary(BORROWER) | `0x75b89902976811758cdff54d65e10a5f051073669c9528200ea272d790a172a9` |
| Wrap | 0.015 OKB → WOKB (DEPLOYER) | `0x328350428981bff1bfd3122e4c6d86fe0bc94dfbccf6c7edfaf370c632a795bb` |
| Attest (attack) | ATTACKER posts a **divergent** mark: wTSLAx @ $389.28 vs true $377.94 (3% > 0.5% band), status REGULAR | `0x4a4cacbbfac58234705196ce0fff92e307503a9493b99ad360a94c049898a6d0` |
| **Challenge → SLASH (HERO)** | independent REPORTER-signed report at true $377.94 → attester's 0.005 WOKB slashed to the harmed borrower; asset latched `diverged` | `0x485a2fd82d0e8ca9f0ed11edf7d8064d3a1bee77f3a090015bb958f9568ae0c0` |

## What the slash proves (recomputable from public state)
- **Real value moved:** BORROWER WOKB balance `0 → 0.005` (5e15 wei); ATTACKER `stakeOf` `0.005 → 0`.
- **Organic trigger:** the on-chain `Slashed` event reason is `price-divergence` — the divergence between the attester's posted price and an independent EIP-712-signed report, not an operator/owner flip. No owner slash path exists.
- **Circuit breaker latched:** post-slash `safePrice(wTSLAx)` reverts `Diverged()` (`0xefac79d8`) — a proven-wrong attester can no longer serve.

## Re-resolve it yourself (public RPC, zero of our infra) — HERO-PROOF
```bash
# 1) the slash event, straight from public X Layer 196:
cast logs --address 0xF3d0E2768F43062b532b3d4bb63c155238FA9176 \
  "Slashed(address,address,address,uint256,string)" \
  --from-block 71514150 --to-block 71514160 --rpc-url https://rpc.xlayer.tech
# → asset=wTSLAx, attester=0xd5a2…cC0d, beneficiary=0x184a…6a98, amount=5000000000000000, reason="price-divergence"

# 2) confirm the borrower received the slashed WOKB:
cast call 0xe538905cf8410324e03A5A23C1c177a474D59b2b "balanceOf(address)(uint256)" \
  0x184a985e244BB070D4F58872B742896fdcc46a98 --rpc-url https://rpc.xlayer.tech
# → 5000000000000000

# 3) confirm the asset is latched diverged (safePrice now refuses):
cast call 0xF3d0E2768F43062b532b3d4bb63c155238FA9176 "safePrice(address)(uint256)" \
  0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171 --rpc-url https://rpc.xlayer.tech
# → reverts 0xefac79d8 (Diverged)
```

## Consumer beat (wrongful-liquidation refusal, F-008)
Demonstrated by the green test suite (`test_BorrowThenLiquidateRefusedOnHalt`) and on a mainnet-fork with dust wTSLAx dealt to the borrower — because wTSLAx has no retail liquidity on X Layer (issuer-KYC mint-on-deposit wrapper). See LIMITATIONS. The primitive's HERO slash above is on public mainnet.

## External (non-team) reader — F-014
PENDING (try-else-disclose). One-line command for any non-team wallet to read the primitive:
```bash
cast call 0xF3d0E2768F43062b532b3d4bb63c155238FA9176 "isTradeable(address)(bool)" \
  0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171 --rpc-url https://rpc.xlayer.tech
```

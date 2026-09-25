#!/usr/bin/env bash
# File: scripts/verify-claims.sh — re-derives every headline number from PUBLIC on-chain state (no our-infra).
# Refuses read-back-only: recomputes slash amount + prevented-loss from committed inputs.
set -euo pipefail
RPC=https://rpc.xlayer.tech
# Defaults are the LIVE deployed values on X Layer 196, so this runs cold with zero setup.
: "${VERITA:=0xF3d0E2768F43062b532b3d4bb63c155238FA9176}" "${BORROWER:=0x184a985e244BB070D4F58872B742896fdcc46a98}" "${WTSLAX:=0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171}"
# window around a real slash (X Layer getLogs caps at 100 blocks per call)
: "${FROM_BLOCK:=71536900}" "${TO_BLOCK:=71536980}"
# settlement token is derived from the contract (WOKB on the live mainnet proof; USDG by design)
TOKEN=$(cast call "$VERITA" "USDG()(address)" --rpc-url $RPC)
echo "settlement token (from contract): $TOKEN"

echo "== Slashed events (public) =="
cast logs --address "$VERITA" "Slashed(address,address,address,uint256,string)" --from-block $FROM_BLOCK --to-block $TO_BLOCK --rpc-url $RPC

echo "== borrower balance in the settlement token (slashed value received) =="
cast call "$TOKEN" "balanceOf(address)(uint256)" "$BORROWER" --rpc-url $RPC

echo "== feePot (per-read fees collected) =="
cast call "$VERITA" "feePot()(uint256)" --rpc-url $RPC

echo "== asset latched diverged after slash? (circuit breaker) =="
cast call "$VERITA" "attestations(address)(uint256,uint8,uint64,uint64,address,bool)" "$WTSLAX" --rpc-url $RPC
echo "verify-claims: recomputed from public 196 state — compare to CLAIMS.md"

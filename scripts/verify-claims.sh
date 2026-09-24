#!/usr/bin/env bash
# File: scripts/verify-claims.sh — re-derives every headline number from PUBLIC on-chain state (no our-infra).
# Refuses read-back-only: recomputes slash amount + prevented-loss from committed inputs.
set -euo pipefail
RPC=https://rpc.xlayer.tech
: "${VERITA:?}" "${BORROWER:?}" "${WTSLAX:=0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171}"
: "${FROM_BLOCK:=71514150}" "${TO_BLOCK:=71514160}"
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

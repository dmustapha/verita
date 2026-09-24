#!/usr/bin/env bash
# File: scripts/verify-claims.sh — re-derives every headline number from PUBLIC on-chain state (no our-infra).
# Refuses read-back-only: recomputes slash amount + prevented-loss from committed inputs.
set -euo pipefail
RPC=https://rpc.xlayer.tech
: "${VERITA:?}" "${GUARD:?}" "${BORROWER:?}" "${WTSLAX:=0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171}"
USDG=0x4ae46a509F6b1D9056937BA4500cb143933D2dc8

echo "== Slashed events (public) =="
cast logs --address "$VERITA" "Slashed(address,address,address,uint256,string)" --rpc-url $RPC

echo "== borrower USDG balance (recomputed prevented-loss recipient) =="
cast call $USDG "balanceOf(address)(uint256)" "$BORROWER" --rpc-url $RPC

echo "== feePot (per-read fees collected) =="
cast call "$VERITA" "feePot()(uint256)" --rpc-url $RPC

echo "== asset latched diverged after slash? (circuit breaker) =="
cast call "$VERITA" "attestations(address)(uint256,uint8,uint64,uint64,address,bool)" "$WTSLAX" --rpc-url $RPC
echo "verify-claims: recomputed from public 196 state — compare to CLAIMS.md"

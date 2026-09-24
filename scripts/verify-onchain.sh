#!/usr/bin/env bash
# File: scripts/verify-onchain.sh — re-checks source-lock + asserts the dead verifier + no VerifierProxy in src/
set -euo pipefail
RPC=https://rpc.xlayer.tech
USDG=0x4ae46a509F6b1D9056937BA4500cb143933D2dc8
WTSLAX=0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171
DEAD=0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7

[ "$(cast call $USDG 'decimals()(uint8)' --rpc-url $RPC)" = "6" ] || { echo "USDG decimals != 6"; exit 1; }
[ "$(cast call $WTSLAX 'symbol()(string)' --rpc-url $RPC)" = '"wTSLAx"' ] || { echo "wTSLAx symbol mismatch"; exit 1; }
# dead verifier must revert
if cast call $DEAD 'verify(bytes,bytes)' 0x0001 0x --rpc-url $RPC 2>/dev/null; then
  echo "FAIL: dead verifier did not revert"; exit 1; fi
# our code must never reference the dead verifier address
if grep -rq "$DEAD" src/; then echo "FAIL: VerifierProxy address present in src/"; exit 1; fi
echo "verify-onchain: OK (USDG 6dp, wTSLAx live, dead verifier reverts, src clean)"

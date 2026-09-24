#!/usr/bin/env bash
# File: scripts/verify.sh — the ONE release-gate command, reused byte-identical in local dev and CI.
# Offline + deterministic ONLY (no live-network tests). Live proof runs under a separate explicit command.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "== forge build =="
forge build
echo "== forge test (offline unit + contract tiers) =="
forge test -vvv
echo "verify: OK"

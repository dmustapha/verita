// File: web/lib/positions.ts
import { Contract } from "ethers";
import { provider } from "./verita";
const GUARD_ABI = [
  "function positions(address) view returns (uint256 collateral,uint256 debt)",
  "function healthFactorBps(address) view returns (uint256)",
];
export function guard() {
  return new Contract(process.env.NEXT_PUBLIC_GUARD!, GUARD_ABI, provider());
}
// health factor is a non-view (reads safePrice) -> use callStatic-style read via provider.call through the contract
export async function readHealthBps(borrower: string): Promise<bigint> {
  if (!process.env.NEXT_PUBLIC_GUARD) return 0n; // no live consumer on mainnet (fork-only) — graceful
  const c = guard();
  try { return await c.healthFactorBps.staticCall(borrower); }
  catch { return 0n; } // safePrice reverted -> mark is unsafe (halted/stale/diverged)
}

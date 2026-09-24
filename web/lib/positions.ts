// File: web/lib/positions.ts
import { JsonRpcProvider, Contract } from "ethers";
const RPC = "https://rpc.xlayer.tech";
const GUARD_ABI = [
  "function positions(address) view returns (uint256 collateral,uint256 debt)",
  "function healthFactorBps(address) view returns (uint256)",
];
export function guard() {
  return new Contract(process.env.NEXT_PUBLIC_GUARD!, GUARD_ABI, new JsonRpcProvider(RPC));
}
// health factor is a non-view (reads safePrice) -> use callStatic-style read via provider.call through the contract
export async function readHealthBps(borrower: string): Promise<bigint> {
  const c = guard();
  try { return await c.healthFactorBps.staticCall(borrower); }
  catch { return 0n; } // safePrice reverted -> mark is unsafe (halted/stale/diverged)
}

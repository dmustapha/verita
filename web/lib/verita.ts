// File: web/lib/verita.ts
import { JsonRpcProvider, Contract, Network } from "ethers";
const RPC = "https://rpc.xlayer.tech";

// X Layer public RPC chokes on ethers' network auto-detection and on multi-call batches
// (browser: "JsonRpcProvider failed to detect network"). Pin a STATIC network so there is no
// detection round-trip, disable request batching, and SHARE one provider across all reads.
const XLAYER = Network.from(196);
let _p: JsonRpcProvider | null = null;
export function provider(): JsonRpcProvider {
  if (!_p) {
    _p = new JsonRpcProvider(RPC, XLAYER, { staticNetwork: XLAYER, batchMaxCount: 1 });
  }
  return _p;
}

const ABI = [
  "function isTradeable(address) view returns (bool)",
  "function attestations(address) view returns (uint256 price,uint8 status,uint64 timestamp,uint64 expiry,address attester,bool diverged)",
  "function feePot() view returns (uint256)",
  "function stakeOf(address) view returns (uint256)",
  "function lockedForAsset(address attester,address asset) view returns (uint256)",
  "function USDG() view returns (address)", // settlement token is a constructor param (WOKB live, USDG designed-for)
];
const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
export function verita() { return new Contract(process.env.NEXT_PUBLIC_VERITA!, ABI, provider()); }

// Read the ACTUAL settlement token + its decimals/symbol from the contract, so money amounts are
// formatted and labeled correctly regardless of which token this Verita was deployed with (AMEND-3).
// Cached — decimals/symbol never change.
let _tok: { address: string; decimals: number; symbol: string } | null = null;
export async function settlementToken(): Promise<{ address: string; decimals: number; symbol: string }> {
  if (_tok) return _tok;
  const p = provider();
  const address: string = await verita().USDG();
  const t = new Contract(address, ERC20_ABI, p);
  const [decimals, symbol] = await Promise.all([t.decimals(), t.symbol()]);
  _tok = { address, decimals: Number(decimals), symbol: String(symbol) };
  return _tok;
}
export const STATUS = ["UNKNOWN","PRE","REGULAR","POST","OVERNIGHT","CLOSED","HALTED","SPLIT_PENDING","DEPEGGED"];

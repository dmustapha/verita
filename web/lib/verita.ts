// File: web/lib/verita.ts
import { JsonRpcProvider, Contract } from "ethers";
const RPC = "https://rpc.xlayer.tech";
const ABI = [
  "function isTradeable(address) view returns (bool)",
  "function attestations(address) view returns (uint256 price,uint8 status,uint64 timestamp,uint64 expiry,address attester,bool diverged)",
  "function feePot() view returns (uint256)",
  "function USDG() view returns (address)", // settlement token is a constructor param (WOKB live, USDG designed-for)
];
const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];
export function provider() { return new JsonRpcProvider(RPC); }
export function verita() { return new Contract(process.env.NEXT_PUBLIC_VERITA!, ABI, provider()); }

// Read the ACTUAL settlement token + its decimals/symbol from the contract, so money amounts are
// formatted and labeled correctly regardless of which token this Verita was deployed with (AMEND-3).
export async function settlementToken(): Promise<{ address: string; decimals: number; symbol: string }> {
  const p = provider();
  const address: string = await verita().USDG();
  const t = new Contract(address, ERC20_ABI, p);
  const [decimals, symbol] = await Promise.all([t.decimals(), t.symbol()]);
  return { address, decimals: Number(decimals), symbol: String(symbol) };
}
export const STATUS = ["UNKNOWN","PRE","REGULAR","POST","OVERNIGHT","CLOSED","HALTED","SPLIT_PENDING","DEPEGGED"];

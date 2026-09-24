// File: web/lib/verita.ts
import { JsonRpcProvider, Contract } from "ethers";
const RPC = "https://rpc.xlayer.tech";
const ABI = [
  "function isTradeable(address) view returns (bool)",
  "function attestations(address) view returns (uint256 price,uint8 status,uint64 timestamp,uint64 expiry,address attester,bool diverged)",
  "function feePot() view returns (uint256)",
];
export function verita() { return new Contract(process.env.NEXT_PUBLIC_VERITA!, ABI, new JsonRpcProvider(RPC)); }
export const STATUS = ["UNKNOWN","PRE","REGULAR","POST","OVERNIGHT","CLOSED","HALTED","SPLIT_PENDING","DEPEGGED"];

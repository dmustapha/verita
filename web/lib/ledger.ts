// File: web/lib/ledger.ts
// Real reads: the Slashed events, decoded from the receipts of the known slash transactions.
// The X Layer public RPC rejects eth_getLogs ("-32019 block is out of range"), so instead of a
// log range query we read each slash tx receipt (eth_getTransactionReceipt — always served) and
// decode its Slashed event on-chain. Every row is real; nothing is fabricated. New slashes fired
// from the live kill-shot in-session are prepended via addSessionSlash().
import { Interface, formatUnits } from "ethers";
import { provider, settlementToken } from "./verita";

export type SlashRow = {
  ticker: string;
  asset: string;
  attester: string;
  beneficiary: string;
  amount: string;   // settlement-token amount, formatted
  symbol: string;
  reason: string;
  txHash: string;
  blockNumber: number;
};

export type LedgerResult =
  | { ok: true; rows: SlashRow[] }
  | { ok: false; error: string };

const IFACE = new Interface([
  "event Slashed(address indexed asset, address indexed attester, address indexed beneficiary, uint256 amount, string reason)",
]);
const SLASHED_TOPIC = IFACE.getEvent("Slashed")!.topicHash;

// The real organic-divergence slashes on public X Layer 196 — one per asset (proof: submission/proof.md).
const KNOWN_SLASHES: { ticker: string; txHash: string }[] = [
  { ticker: "AAPL", txHash: "0x5e19534426d3e5b37ca85ebc2869b03b132546d45cba3ea813de610ea26858f6" },
  { ticker: "SPY",  txHash: "0xa4eae8bf8917715f25db1127ff82a0c54681d93a3d47c747c2aaccbf6dac0e2c" },
  { ticker: "NVDA", txHash: "0x6f88d59346bd68138b1587ad76cb63c83524f3424bbc0d60ad0297287d4afaa6" },
  { ticker: "TSLA", txHash: "0x485a2fd82d0e8ca9f0ed11edf7d8064d3a1bee77f3a090015bb958f9568ae0c0" },
];

async function decodeSlash(ticker: string, txHash: string, tok: { decimals: number; symbol: string }): Promise<SlashRow | null> {
  const r = await provider().getTransactionReceipt(txHash);
  if (!r) return null;
  for (const log of r.logs) {
    if (log.topics[0] !== SLASHED_TOPIC) continue;
    const p = IFACE.parseLog({ topics: [...log.topics], data: log.data });
    if (!p) continue;
    return {
      ticker,
      asset: p.args.asset as string,
      attester: p.args.attester as string,
      beneficiary: p.args.beneficiary as string,
      amount: Number(formatUnits(p.args.amount as bigint, tok.decimals)).toFixed(3),
      symbol: tok.symbol,
      reason: String(p.args.reason),
      txHash,
      blockNumber: Number(r.blockNumber),
    };
  }
  return null;
}

export async function readLedger(): Promise<LedgerResult> {
  if (!process.env.NEXT_PUBLIC_VERITA) return { ok: false, error: "Verita address not configured" };
  try {
    const tok = await settlementToken();
    const rows = (await Promise.all(KNOWN_SLASHES.map((s) => decodeSlash(s.ticker, s.txHash, tok).catch(() => null))))
      .filter((x): x is SlashRow => x !== null)
      .sort((a, b) => b.blockNumber - a.blockNumber);
    if (rows.length === 0) return { ok: false, error: "no slash receipts resolved" };
    return { ok: true, rows };
  } catch (e: any) {
    return { ok: false, error: e?.shortMessage || e?.message || "ledger read failed" };
  }
}

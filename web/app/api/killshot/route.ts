// File: web/app/api/killshot/route.ts
// Scoped, rate-limited server-side trigger. Uses the demo relayer key (small funds), NEVER a root key.
import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

let lastCall = 0;
export async function POST() {
  const now = Date.now();
  if (now - lastCall < 30_000) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  lastCall = now;
  const provider = new JsonRpcProvider("https://rpc.xlayer.tech");
  const relayer = new Wallet(process.env.RELAYER_PK!, provider); // demo key, small funded amount
  const verita = new Contract(process.env.NEXT_PUBLIC_VERITA!, ["function challenge(address,(address,uint256,uint8,uint64,uint256,bytes))"], relayer);
  // Load the independent signed report (live from Source B, or the disclosed pre-seeded report).
  // CRITICAL: coerce the large numeric fields to BigInt — price/timestampNs/nonce exceed 2^53 and
  // JSON.parse would silently lose precision, changing the digest and reverting NotAReporter.
  const j = JSON.parse(process.env.KILLSHOT_REPORT_JSON!);
  const report = {
    asset: j.asset,
    price: BigInt(j.price),
    status: Number(j.status),
    timestampNs: BigInt(j.timestampNs),
    nonce: BigInt(j.nonce),
    sig: j.sig,
  };
  const tx = await verita.challenge(process.env.NEXT_PUBLIC_WTSLAX!, report);
  const rcpt = await tx.wait();
  return NextResponse.json({ txHash: rcpt.hash });
}

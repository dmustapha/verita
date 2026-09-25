// File: web/app/api/killshot/route.ts
// Scoped, rate-limited, keys-off-host kill-shot. A cold judge with NO local keys clicks one button and
// a real organic-divergence slash fires on public X Layer 196.
//
// LIVE, NOT REPLAYED (change-order v1.4): this route fetches the live independent price at click-time,
// signs a FRESH EIP-712 report with the authorized reporter key, then challenges. It does NOT replay a
// pre-signed report. The on-chain challenge() still independently enforces auth + real divergence, so a
// non-divergent mark reverts NoDivergence — the slash is never fabricated.
//
// Keys: REPORTER_PK only SIGNS reports (cannot move funds — slashing pays the beneficiary and requires
// real on-chain divergence); RELAYER_PK is a small-funded gas key (never a root key). Both are server-only
// (never NEXT_PUBLIC_) and gitignored. Production hardening (keys on a separate relayer service) → DH-8.
import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const RPC = "https://rpc.xlayer.tech";
const CHAIN_ID = 196;

let lastCall = 0;

// Derive the equity ticker from the wrapped-stock token's on-chain symbol (wTSLAx -> TSLA). No hardcoded map.
async function tickerFor(provider: JsonRpcProvider, token: string): Promise<string> {
  const t = new Contract(token, ["function symbol() view returns (string)"], provider);
  const sym = String(await t.symbol());           // e.g. "wSPYx"
  return sym.replace(/^w/i, "").replace(/x$/i, ""); // -> "SPY"
}

// Live independent price at click-time: Source B (Finnhub) first, Yahoo v8 fallback. Fail closed (null).
async function livePrice8dp(ticker: string): Promise<bigint | null> {
  const key = process.env.SOURCE_B_KEY;
  if (key) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`);
      const j: any = await r.json().catch(() => null);
      if (j && typeof j.c === "number" && Number.isFinite(j.c) && j.c > 0) return BigInt(Math.round(j.c * 1e8));
    } catch { /* fall through to Yahoo */ }
  }
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const j: any = await r.json().catch(() => null);
    const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) return BigInt(Math.round(p * 1e8));
  } catch { /* fail closed */ }
  return null;
}

export async function POST() {
  const now = Date.now();
  if (now - lastCall < 30_000) return NextResponse.json({ error: "rate limited — wait 30s between kill-shots" }, { status: 429 });
  lastCall = now;
  try {
    // Target asset: a RUNTIME server var (KILLSHOT_ASSET) takes precedence over the build-inlined
    // NEXT_PUBLIC_WTSLAX, so the demo target can be re-pointed without a rebuild (NEXT_PUBLIC_* is frozen
    // at build time, which would otherwise silently fire on a stale asset).
    const asset = process.env.KILLSHOT_ASSET || process.env.NEXT_PUBLIC_WTSLAX;
    if (!process.env.RELAYER_PK || !process.env.REPORTER_PK || !process.env.NEXT_PUBLIC_VERITA || !asset) {
      return NextResponse.json({ error: "kill-shot not configured on this host (missing relayer/reporter key or target asset)" }, { status: 503 });
    }
    const verita = process.env.NEXT_PUBLIC_VERITA;
    const provider = new JsonRpcProvider(RPC);

    // 1) LIVE price at click-time from an independent stream (no replay).
    const ticker = await tickerFor(provider, asset);
    const price = await livePrice8dp(ticker);
    if (price === null) {
      // Fail closed: never fabricate a price, never fall back to a canned report.
      return NextResponse.json({ error: `no live independent price for ${ticker} right now — try again` }, { status: 502 });
    }

    // 2) sign a FRESH EIP-712 report with the authorized reporter key.
    const reporter = new Wallet(process.env.REPORTER_PK);
    const domain = { name: "Verita", version: "1", chainId: CHAIN_ID, verifyingContract: verita };
    const types = { ReporterReport: [
      { name: "asset", type: "address" }, { name: "price", type: "uint256" },
      { name: "status", type: "uint8" }, { name: "timestampNs", type: "uint64" }, { name: "nonce", type: "uint256" },
    ]};
    const nonce = BigInt(Date.now());
    const timestampNs = BigInt(Date.now()) * 1_000_000n;
    const status = 2; // REGULAR — the report is a truthful independent mark; divergence (not status) drives the slash
    const value = { asset, price, status, timestampNs, nonce };
    const sig = await reporter.signTypedData(domain, types, value);

    // 3) challenge with the small-funded gas key. Named tuple components (ethers rejects object args
    //    against an unnamed tuple). challenge() re-checks auth + real divergence on-chain.
    const relayer = new Wallet(process.env.RELAYER_PK, provider);
    const c = new Contract(verita, ["function challenge(address asset,(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce,bytes sig) report)"], relayer);
    const tx = await c.challenge(asset, { asset, price, status, timestampNs, nonce, sig });
    const rcpt = await tx.wait();
    return NextResponse.json({ txHash: rcpt.hash, ticker, price: price.toString() });
  } catch (e: any) {
    // Common on-chain reasons: asset already latched diverged / within band (NoDivergence), relayer out of
    // gas. Always return JSON so the client's r.json() never throws SyntaxError on a raw 500.
    const reason = e?.shortMessage || e?.reason || e?.message || "kill-shot reverted on-chain";
    return NextResponse.json({ error: String(reason) }, { status: 502 });
  }
}

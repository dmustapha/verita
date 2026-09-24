// File: relayer/src/index.ts
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { sourceChainlink, sourceYahoo, sourceB } from "./sources";
import { signReport } from "./sign";

const RPC = "https://rpc.xlayer.tech";
const VERITA = process.env.VERITA!;
const WTSLAX = process.env.WTSLAX!;
const ABI = [
  "function attest(address,uint256,uint8,uint64)",
  "function challenge(address,(address,uint256,uint8,uint64,uint256,bytes))",
];

const to8dp = (usd: number) => BigInt(Math.round(usd * 1e8));

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const attester = new Wallet(process.env.ATTESTER_PK!, provider);
  const reporter = new Wallet(process.env.REPORTER_PK!, provider);
  const verita = new Contract(VERITA, ABI, attester);

  // 1) attest from Source A (Chainlink REST or Yahoo fallback)
  const a = (await sourceChainlink("TSLA")) ?? (await sourceYahoo("TSLA"));
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  await (await verita.attest(WTSLAX, to8dp(a.price), a.status, expiry)).wait();

  // 2) independent Source B report; if it diverges > band, challenge (organic slash)
  const b = await sourceB("TSLA");
  if (b) {
    const report = await signReport(reporter, VERITA, WTSLAX, to8dp(b.price), b.status, BigInt(Date.now()));
    const diverges = Math.abs(b.price - a.price) / a.price > 0.005;
    if (diverges) {
      const v2 = verita.connect(reporter) as any;
      await (await v2.challenge(WTSLAX, report)).wait();
    }
  }
  // else: pre-seeded signed report (disclosed fallback) — see PLAN DT-3
}
main().catch((e) => { console.error(e); process.exit(1); });

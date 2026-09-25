// Wire helper: produce an independent REPORTER-signed report (Source-B true price) for the kill-shot.
import { Wallet } from "ethers";
import { signReport } from "./sign.js";
async function main() {
  const [asset, price8dp, statusStr] = process.argv.slice(2);
  const reporter = new Wallet(process.env.REPORTER_PK!);
  const nonce = BigInt(Date.now());
  const r = await signReport(reporter, process.env.VERITA!, asset, BigInt(price8dp), Number(statusStr), nonce);
  // serialize BigInts as decimal strings for KILLSHOT_REPORT_JSON
  console.log(JSON.stringify({
    asset: r.asset, price: r.price.toString(), status: r.status,
    timestampNs: r.timestampNs.toString(), nonce: r.nonce.toString(), sig: r.sig,
  }));
}
main().catch(e => { console.error(e); process.exit(1); });

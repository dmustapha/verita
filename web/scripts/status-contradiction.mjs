// scripts/status-contradiction.mjs
// CO-T1 (Change-Order v1.5): fire ONE real MARKET-STATUS-contradiction slash on public X Layer 196.
//
// The market-STATUS moat proven live for the first time. Every prior live slash was price-divergence.
// Here: attester stakes + attests REGULAR at the TRUE price; an authorized reporter signs a HALTED
// report at the SAME price (ZERO price divergence) -> challenge() slashes on statusContradicts, and
// Slashed(...reason) decodes to "status-contradiction" (NOT "price-divergence").
//
// Asset: wNVDAx (real NVDA xStock wrapper on 196) — NOT the kill-shot asset, NOT the flagship hero.
// Spend: dust WOKB (minStake 5e15) moves DEPLOYER(attester)->BORROWER(beneficiary), all Dami wallets,
// recoverable. APPROVED (change-order v1.5). Contracts UNTOUCHED (no redeploy).
//
// Run:  node scripts/status-contradiction.mjs        (reads ../.env)
import { readFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, Contract, Network, Interface } from "ethers";

const RPC = "https://rpc.xlayer.tech";
const CHAIN_ID = 196;

// ---- load ../.env (KEY=VALUE, ignores comments/blanks) ----
const env = {};
for (const line of readFileSync(new URL("../../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const need = (k) => { if (!env[k]) throw new Error(`missing ${k} in .env`); return env[k]; };

const VERITA = need("NEXT_PUBLIC_VERITA");
const NVDA = "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5"; // real wNVDAx wrapper on 196
const BORROWER = need("BORROWER_ADDR");

const XLAYER = Network.from(CHAIN_ID);
const provider = new JsonRpcProvider(RPC, XLAYER, { staticNetwork: XLAYER, batchMaxCount: 1 });

const deployer = new Wallet(need("DEPLOYER_PK"), provider); // the lying attester
const borrower = new Wallet(need("BORROWER_PK"), provider); // holds the WOKB, is the harmed beneficiary
const reporter = new Wallet(need("REPORTER_PK"), provider); // authorized EIP-712 reporter (signs only)
const relayer = new Wallet(need("RELAYER_PK"), provider);   // submits the challenge (gas only)

const V_ABI = [
  "function USDG() view returns (address)",
  "function minStake() view returns (uint256)",
  "function stakeOf(address) view returns (uint256)",
  "function lockedOf(address) view returns (uint256)",
  "function slashBeneficiary(address) view returns (address)",
  "function stake(uint256)",
  "function attest(address asset,uint256 price,uint8 status,uint64 expiry)",
  "function registerBeneficiary(address asset,address beneficiary)",
  "function challenge(address asset,(address asset,uint256 price,uint8 status,uint64 timestampNs,uint256 nonce,bytes sig) report)",
];
const ERC20 = ["function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];
const SLASHED = new Interface(["event Slashed(address indexed asset,address indexed attester,address indexed beneficiary,uint256 amount,string reason)"]);

const REGULAR = 2, HALTED = 6;

async function main() {
  const vRead = new Contract(VERITA, V_ABI, provider);
  const wokbAddr = await vRead.USDG();
  const minStake = await vRead.minStake();
  const wokb = new Contract(wokbAddr, ERC20, provider);
  console.log(`WOKB ${wokbAddr} · minStake ${minStake}`);

  // true price = live NVDA (8dp). Reporter reports the SAME price -> zero divergence, status is the sole cause.
  const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = await r.json();
  const px = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!(typeof px === "number" && px > 0)) throw new Error("no live NVDA price");
  const price8dp = BigInt(Math.round(px * 1e8));
  console.log(`NVDA true price $${px} -> ${price8dp} (8dp) — attester REGULAR + reporter HALTED, both at this price`);

  // 1) fund the attester (DEPLOYER) with exactly minStake WOKB from the borrower's holdings (net-zero: slashed back to borrower).
  const depBal = await wokb.balanceOf(deployer.address);
  if (depBal < minStake) {
    console.log(`funding attester ${deployer.address} with ${minStake} WOKB from borrower…`);
    const t = await new Contract(wokbAddr, ERC20, borrower).transfer(deployer.address, minStake);
    await t.wait(); console.log(`  funded · ${t.hash}`);
  }

  // 2) attester stakes minStake + attests REGULAR at the true price
  const vDep = new Contract(VERITA, V_ABI, deployer);
  const free = (await vRead.stakeOf(deployer.address)) - (await vRead.lockedOf(deployer.address));
  if (free < minStake) {
    const a = await new Contract(wokbAddr, ERC20, deployer).approve(VERITA, minStake); await a.wait();
    const s = await vDep.stake(minStake); await s.wait(); console.log(`staked ${minStake} · ${s.hash}`);
  } else console.log(`attester already has ${free} free stake`);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const at = await vDep.attest(NVDA, price8dp, REGULAR, expiry); await at.wait();
  console.log(`attested wNVDAx REGULAR @ ${price8dp} · ${at.hash}`);

  // 3) beneficiary = the harmed borrower (set-once; skip if already set)
  if ((await vRead.slashBeneficiary(NVDA)) === "0x0000000000000000000000000000000000000000") {
    const rb = await vDep.registerBeneficiary(NVDA, BORROWER); await rb.wait();
    console.log(`beneficiary set -> borrower · ${rb.hash}`);
  }

  // 4) authorized reporter signs a HALTED report at the SAME price (zero price divergence)
  const domain = { name: "Verita", version: "1", chainId: CHAIN_ID, verifyingContract: VERITA };
  const types = { ReporterReport: [
    { name: "asset", type: "address" }, { name: "price", type: "uint256" },
    { name: "status", type: "uint8" }, { name: "timestampNs", type: "uint64" }, { name: "nonce", type: "uint256" },
  ]};
  const nonce = BigInt(Date.now());
  const timestampNs = BigInt(Date.now()) * 1_000_000n;
  const value = { asset: NVDA, price: price8dp, status: HALTED, timestampNs, nonce };
  const sig = await reporter.signTypedData(domain, types, value);
  console.log(`reporter ${reporter.address} signed HALTED report (status ${HALTED}) @ same price ${price8dp}`);

  // 5) relayer submits the challenge -> status-contradiction slash
  const vRel = new Contract(VERITA, V_ABI, relayer);
  const tx = await vRel.challenge(NVDA, { asset: NVDA, price: price8dp, status: HALTED, timestampNs, nonce, sig });
  const rcpt = await tx.wait();
  console.log(`\nCHALLENGE tx: ${rcpt.hash} · status ${rcpt.status}`);

  // 6) decode + assert reason
  let reason = null, amount = null, benef = null;
  for (const log of rcpt.logs) {
    try { const p = SLASHED.parseLog({ topics: [...log.topics], data: log.data }); if (p) { reason = p.args.reason; amount = p.args.amount; benef = p.args.beneficiary; } } catch {}
  }
  console.log(`Slashed reason: "${reason}" · amount ${amount} · beneficiary ${benef}`);
  if (reason !== "status-contradiction") throw new Error(`EXPECTED status-contradiction, GOT "${reason}"`);
  console.log(`\n✅ CO-T1 PROVEN: market-STATUS contradiction slash on public 196.`);
  console.log(`STATUS_SLASH_TX=${rcpt.hash}`);
}
main().catch((e) => { console.error("FAILED:", e?.shortMessage || e?.message || e); process.exit(1); });

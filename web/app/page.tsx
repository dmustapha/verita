// File: web/app/page.tsx — Verita console. Every panel reads live from X Layer 196.
"use client";
import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { verita, settlementToken, STATUS, provider, readPerReadFee } from "../lib/verita";
import { readHealthBps } from "../lib/positions";
import { readRegistry, RegistryRow } from "../lib/registry";
import { readLedger, LedgerResult } from "../lib/ledger";

const BORROWER = process.env.NEXT_PUBLIC_BORROWER_ADDR || "";
const WTSLAX = process.env.NEXT_PUBLIC_WTSLAX || "";
const OK_TX = (h: string) => `https://www.oklink.com/xlayer/tx/${h}`;
const OK_ADDR = (a: string) => `https://www.oklink.com/xlayer/address/${a}`;
const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

type HeroView = {
  price: string; status: number; diverged: boolean;
  tradeable: boolean; feePot: string; feeSymbol: string; healthBps: string;
};

async function loadHero(): Promise<HeroView> {
  const v = verita();
  const a = await v.attestations(WTSLAX);
  const tradeable = await v.isTradeable(WTSLAX);
  const feePot: bigint = await v.feePot();
  const healthBps = await readHealthBps(BORROWER);
  const tok = await settlementToken();
  return {
    price: (Number(a.price) / 1e8).toFixed(2),
    status: Number(a.status),
    diverged: a.diverged,
    tradeable,
    feePot: Number(formatUnits(feePot, tok.decimals)).toFixed(4),
    feeSymbol: tok.symbol,
    healthBps: healthBps === 0n ? "—" : (Number(healthBps) / 100).toFixed(1) + "%",
  };
}

/* ------------------------------- APP BAR ------------------------------- */
function AppBar() {
  const [block, setBlock] = useState<number | null>(null);
  const [ticked, setTicked] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () =>
      provider()
        .getBlockNumber()
        .then((n) => {
          if (!alive) return;
          setBlock(n);
          setTicked(true);
          setTimeout(() => alive && setTicked(false), 450);
        })
        .catch(() => {});
    read();
    const t = setInterval(read, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <header className="bar">
      <div className="wordmark"><span className="dot" />Verita</div>
      <span className="pill"><span className="b" />X Layer · 196</span>
      <span className={"block-tick" + (ticked ? " tick" : "")}>
        #{block === null ? "—" : block.toLocaleString("en-US").replace(/,/g, "")}
      </span>
      <nav className="nav" aria-label="Primary">
        <a href="#console">Console</a>
        <a href="#registry">Registry</a>
        <a href="#ledger">Ledger</a>
        <a href="#developers">Developers</a>
        <a href="#guarantees">Guarantees</a>
        <a href="/proof">Proof</a>
      </nav>
    </header>
  );
}

/* --------------------------------- HERO -------------------------------- */
function Hero() {
  const [v, setV] = useState<HeroView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [killing, setKilling] = useState(false);
  const [killTx, setKillTx] = useState<string | null>(null);
  const [killErr, setKillErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = () => loadHero().then((x) => alive && setV(x)).catch((e) => alive && setErr(String(e)));
    run();
    const t = setInterval(run, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  async function killShot() {
    setKilling(true); setKillErr(null); setKillTx(null);
    try {
      const r = await fetch("/api/killshot", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "kill-shot failed");
      setKillTx(j.txHash);
      await loadHero().then(setV).catch(() => {});
    } catch (e: any) { setKillErr(String(e?.message || e)); }
    finally { setKilling(false); }
  }

  const refused = v ? !v.tradeable || v.diverged : false;
  return (
    <section className="hero" id="console">
      <div className="wrap">
        <div className="kicker">A staked oracle · X Layer 196</div>
        <div className="hero-grid">
          <div>
            <h1>Lie about a price, <em>lose your stake.</em></h1>
            <p className="lede">
              An attester puts collateral behind a tokenized-stock mark. A liquidation guard reads it
              every block. Post a false price, and an independent signed report proves the divergence,
              the wrongful liquidation is <b>refused</b>, and the liar&apos;s stake is <b>slashed on-chain</b> to
              the person it would have harmed.
            </p>
            <div className="chips">
              <span className="chip">Min stake <b>0.005 WOKB</b></span>
              <span className="chip">Divergence band <b>0.50%</b></span>
              <span className="chip">Max price age <b>300s</b></span>
              <span className="chip">Fills the gap where <b>Chainlink&apos;s verifier is dead</b></span>
            </div>
            <details>
              <summary>What is the &quot;dead verifier&quot;?</summary>
              <div className="dbody">
                On X Layer, Chainlink&apos;s on-chain <code>VerifierProxy.verify()</code> reverts{" "}
                <code>VerifierNotFound (0xb151802b)</code> — there is no working on-chain price
                verification. Verita replaces it with a staked attestation plus an EIP-712 signed
                divergence report, so a lie has a cost and a proof.
              </div>
            </details>
          </div>

          {/* MONEY MOMENT — real reads + real kill-shot tx */}
          <div className="verdict" data-state={refused ? "refused" : "safe"}>
            <div className="v-head">
              <div className="who">Live position · <b>reference asset</b> guarding a borrower</div>
              <span className="v-tag">{v ? (refused ? "REFUSED" : "SAFE") : "READING"}</span>
            </div>

            {!v && !err && (
              <>
                <div className="skeleton skeleton--title" />
                <div className="skeleton" /><div className="skeleton" />
                <p className="v-foot">Loading the live position from X Layer 196…</p>
              </>
            )}

            {err && !v && (
              <>
                <p className="v-quote">Can&apos;t reach X Layer 196 right now — the live read isn&apos;t resolving.</p>
                <details><summary>Technical detail</summary><div className="dbody"><code>{err}</code></div></details>
              </>
            )}

            {v && (
              <>
                <div className="marks">
                  <div className="mark-live">${v.price}</div>
                  <div className="mark-true">attested mark · status <b>{STATUS[v.status]}</b></div>
                </div>
                <p className="v-quote">
                  {refused
                    ? "Mark rejected as unsafe — the guard refuses to liquidate against it."
                    : "The attested mark is accepted within band. Liquidation permitted only if honest."}
                </p>
                <div className="rowline"><span className="lbl">Health factor</span><span className="val">{v.healthBps}</span></div>
                <div className="rowline"><span className="lbl">Per-read fees collected (feePot)</span><span className="val">{v.feePot} {v.feeSymbol}</span></div>
                <div className="rowline"><span className="lbl">Verdict</span><span className="val" style={{ color: refused ? "var(--red)" : "var(--green)" }}>{refused ? "REFUSED" : "SAFE"}</span></div>

                <button className="kill" onClick={killShot} disabled={killing}>
                  {killing ? "Signing independent report… challenging on-chain…" : "Run the kill-shot"}
                </button>
                {killTx && (
                  <p className="tx-ok">
                    Slash fired on-chain · <a href={OK_TX(killTx)} target="_blank" rel="noreferrer">{short(killTx)} ↗</a>
                  </p>
                )}
                {killErr && <p className="tx-err">{killErr}</p>}
                <div className="v-foot">
                  <span>Reading mark every block · guard armed</span>
                  <span className="mono">{short(BORROWER)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- REGISTRY ------------------------------ */
function Registry() {
  const [rows, setRows] = useState<RegistryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    readRegistry().then((r) => alive && setRows(r)).catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);
  return (
    <section id="registry">
      <div className="wrap">
        <div className="shead">
          <div className="kicker">The record of who lied</div>
          <h2>Attested Asset Registry</h2>
          <p>Four attesters posted marks on public X Layer. Each row is read live from the contract — every one is currently latched diverged, their permanent track record.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col" className="num">Attested mark</th>
                <th scope="col">Status</th>
                <th scope="col">Verdict</th>
                <th scope="col">Tradeable</th>
                <th scope="col">Stake behind</th>
                <th scope="col">Attester</th>
              </tr>
            </thead>
            <tbody>
              {!rows && !err && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={7}><div className="skeleton" /></td></tr>
              ))}
              {err && !rows && (
                <tr><td colSpan={7}><div className="empty">Registry read unavailable — X Layer 196 isn&apos;t resolving right now.</div></td></tr>
              )}
              {rows && rows.map((r) => (
                <tr key={r.address}>
                  <td className="tk">{r.ticker}<small>{r.address.slice(0, 6)}…{r.address.slice(-4)}</small></td>
                  <td className="num tnum">${r.price}</td>
                  <td>{r.statusLabel}</td>
                  <td><span className={"badge " + (r.diverged ? "diverged" : "safe")}>{r.diverged ? "Diverged" : "Safe"}</span></td>
                  <td className="mono">{r.tradeable ? "yes" : "no"}</td>
                  <td className="mono">{r.stakeBehind} {r.stakeSymbol}</td>
                  <td><a className="txlink" href={OK_ADDR(r.attester)} target="_blank" rel="noreferrer">{short(r.attester)} ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <p><b>Status</b> — the market state the attester claimed: REGULAR / HALTED / SPLIT_PENDING / DEPEGGED / CLOSED …</p>
          <p><b>Verdict / Diverged</b> — whether an independent report caught a lie and latched the circuit breaker.</p>
          <p className="close">These are independent axes. An asset can read <b>REGULAR</b> in Status yet <b>Diverged</b> in Verdict — the attester claimed the market was open, but was caught and slashed.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ LIFECYCLE ------------------------------ */
const ARROW = (
  <span className="arrow" aria-hidden="true">
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 5h6M5 2l3 3-3 3" /></svg>
  </span>
);
function Lifecycle() {
  return (
    <section>
      <div className="wrap">
        <div className="shead">
          <div className="kicker">How one attestation lives and dies</div>
          <h2>The attestation lifecycle</h2>
        </div>
        <div className="pipe">
          <div className="step"><div className="n">01</div><h4>Stake</h4><p>Attester locks 0.005 WOKB as collateral behind a specific asset mark.</p>{ARROW}</div>
          <div className="step"><div className="n">02</div><h4>Attest</h4><p>Posts a signed price + market status on-chain, valid for 300 seconds.</p>{ARROW}</div>
          <div className="step"><div className="n">03</div><h4>Read</h4><p>The liquidation guard reads the mark every block to compute health.</p>{ARROW}</div>
          <div className="step"><div className="n">04</div><h4>Challenge</h4><p>An independent reporter signs an EIP-712 report proving over 0.50% divergence.</p>{ARROW}</div>
          <div className="step slash"><div className="n">05</div><h4>Slash</h4><p>Wrongful liquidation refused; the stake moves to the harmed borrower.</p></div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------- LEDGER + LIVE GUARD ------------------------- */
function LedgerAndGuard() {
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const [hf, setHf] = useState<string | null>(null);
  const guardUnset = hf === "—";

  useEffect(() => {
    let alive = true;
    readLedger().then((r) => alive && setLedger(r)).catch(() => alive && setLedger({ ok: false, error: "getLogs failed" }));
    const readHf = () =>
      readHealthBps(BORROWER)
        .then((b) => alive && setHf(b === 0n ? "—" : (Number(b) / 100).toFixed(2)))
        .catch(() => alive && setHf("—"));
    readHf();
    const t = setInterval(readHf, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const moved =
    ledger && ledger.ok
      ? ledger.rows.reduce((s, r) => s + Number(r.amount), 0).toFixed(3) + " " + (ledger.rows[0]?.symbol || "WOKB")
      : "—";

  return (
    <section id="ledger">
      <div className="wrap">
        <div className="shead">
          <div className="kicker">Money moved · block by block</div>
          <h2>Stake / Slash Ledger &amp; live guard</h2>
          <p>Left: every slash the contract emitted, paid to the harmed borrower. Right: the consumer reading the mark to compute health.</p>
          <p className="ledger-note">A slash can be triggered by a <b>price lie</b> (a mark that diverges past the band) <b>or a market-status lie</b> — a halt, split or de-peg that no price feed can carry. Each row&apos;s reason is decoded live from its receipt.</p>
        </div>
        <div className="split">
          {/* LEDGER */}
          <div className="panel">
            <div className="panel-head">
              <h3>Stake / Slash Ledger</h3>
              <span className="meta">{ledger && ledger.ok ? `${ledger.rows.length} slashes · ${moved} moved` : "reading receipts"}</span>
            </div>
            {!ledger && <div className="empty">Reading <b>Slashed</b> events from the slash receipts…</div>}
            {ledger && !ledger.ok && (
              <div className="empty">Ledger unavailable right now.<br /><span className="addr">{ledger.error}</span></div>
            )}
            {ledger && ledger.ok && ledger.rows.length === 0 && (
              <div className="empty">No <b>Slashed</b> events resolved yet.</div>
            )}
            {ledger && ledger.ok && ledger.rows.map((r) => {
              const isStatus = r.reason === "status-contradiction";
              return (
              <div className={"event" + (isStatus ? " status-slash" : "")} key={r.txHash + r.beneficiary}>
                <span className="rail" />
                <div className="body">
                  <div className="line1">
                    <b>{r.ticker}</b> attester <b>{short(r.attester)}</b> slashed → borrower <span className="amt">+{r.amount} {r.symbol}</span>
                  </div>
                  <div className="line2">
                    <span>block {r.blockNumber}</span>
                    {isStatus
                      ? <span className="reason-tag status" title="market-status contradiction">HALTED-vs-REGULAR · market-status</span>
                      : <span className="reason-tag price">{r.reason || "price-divergence"}</span>}
                    <a className="txlink" href={OK_TX(r.txHash)} target="_blank" rel="noreferrer">{short(r.txHash)} ↗</a>
                  </div>
                </div>
              </div>
            );})}
          </div>

          {/* GUARD */}
          <div className="panel guard" data-state={guardUnset ? "unset" : "reading"}>
            <div className="panel-head"><h3>Live liquidation guard</h3><span className="meta">reads safePrice()</span></div>
            <div className="guard-body">
              <div className="hf-row">
                <span className="lbl">Borrower health factor</span>
                <span className="hf-val">{hf ?? "…"}</span>
              </div>
              <div className="term">
                <span className="c">// consumer reads the mark to compute health</span>{"\n"}
                mark = Verita.<span className="am">safePrice</span>(asset){"\n"}
                {guardUnset
                  ? <><span className="err">→ no live guard consumer on mainnet</span>{"\n"}health = <span className="am">—</span></>
                  : <><span className="ok">→ within band</span>{"\n"}health = collateral / debt = <span className="am">{hf}</span></>}
              </div>
              <div className="guard-note">
                {guardUnset
                  ? "No live guard consumer is deployed on mainnet, so health reads back empty here. The guard is proven on a fork and in the test suite — the contract-level safePrice() read is real."
                  : "Honest mark, healthy borrower. The guard permits nothing wrongful."}
              </div>
              <details>
                <summary>What happens when it diverges?</summary>
                <div className="dbody">
                  <code>safePrice()</code> reverts <code>Diverged</code> once the circuit-breaker latches. The
                  guard can no longer read a usable price, so it <b>refuses</b> to liquidate — the borrower is
                  protected and the stake is already slashed to them.
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------- DEVELOPER QUICKSTART (CO-S2) ----------------------- */
const VERITA_ADDR = process.env.NEXT_PUBLIC_VERITA || "";
const SNIPPET =
  `require(verita.isTradeable(asset), "unsafe");   // free view — false on stale/halted/split/diverged\n` +
  `uint256 price = verita.safePrice(asset);         // reverts on unsafe input; charges a per-read fee`;

function Developers() {
  const [fee, setFee] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    readPerReadFee().then((f) => alive && setFee(f)).catch(() => alive && setFee(null));
    return () => { alive = false; };
  }, []);

  async function copy() {
    try { await navigator.clipboard.writeText(SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  }

  return (
    <section id="developers">
      <div className="wrap">
        <div className="shead">
          <div className="kicker">The primary user is a contract</div>
          <h2>Integrate in two calls</h2>
          <p>Ask if the mark is safe, then read the price. One free view, one paid read — that is the entire integration.</p>
        </div>
        {VERITA_ADDR && (
          <div className="dev-addr">
            <span className="lbl">Verita · X Layer 196</span>
            <a href={OK_ADDR(VERITA_ADDR)} target="_blank" rel="noreferrer">{VERITA_ADDR} ↗</a>
          </div>
        )}
        <div className="codeblock">
          <button className="copy" onClick={copy}>{copied ? "copied" : "copy"}</button>
          <pre>
            <span className="am">require</span>(verita.<span className="am">isTradeable</span>(asset), <span className="c">&quot;unsafe&quot;</span>);   <span className="c">// free view — false on stale/halted/split/diverged</span>{"\n"}
            <span className="am">uint256</span> price = verita.<span className="am">safePrice</span>(asset);         <span className="c">// reverts on unsafe input; charges a per-read fee</span>
          </pre>
        </div>
        <div className="dev-fee">
          <span className="lbl">Per-read fee · live from chain</span>
          <span className={"val" + (fee ? "" : " loading")}>{fee ?? "reading…"}</span>
        </div>
        <details>
          <summary>Interface &amp; fee detail</summary>
          <div className="dbody">
            <code>isTradeable(address) returns (bool)</code> is a free view; <code>safePrice(address) returns (uint256)</code>{" "}
            reverts on stale/halted/split/diverged input and charges the per-read fee shown above, read live from{" "}
            <code>perReadFee()</code> and denominated in the deployed settlement token.
          </div>
        </details>
      </div>
    </section>
  );
}

/* ---------------------------- GUARANTEES (CO-S3) ---------------------------- */
const GUARANTEES: { claim: string; test: string }[] = [
  { claim: "One stake can never back two assets.", test: "test_CannotDoubleLockAcrossAssets" },
  { claim: "Only an authorized reporter can ever trigger a slash.", test: "test_ChallengeRevertsFromNonReporter" },
  { claim: "A slashed attester keeps whatever free stake wasn't at risk.", test: "test_WithdrawAfterSlash" },
  { claim: "Each asset's payout beneficiary is set once and can't be overwritten.", test: "test_BeneficiarySetOnce" },
];

function Guarantees() {
  return (
    <section id="guarantees">
      <div className="wrap">
        <div className="shead">
          <div className="kicker">What the contract enforces</div>
          <h2>Guarantees, each backed by a passing test</h2>
          <p>Plain-language promises on the surface. The named forge test that proves each one lives behind the expander.</p>
        </div>
        <div className="guarantees">
          {GUARANTEES.map((g) => (
            <div className="guarantee" key={g.test}>
              <div className="guarantee-head">
                <span className="enforced">enforced</span>
                <span className="claim">{g.claim}</span>
              </div>
              <details>
                <summary>proof</summary>
                <div className="dbody">
                  Passing test <code>{g.test}</code> in <code>test/Verita.t.sol</code>.
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- FOOTER ------------------------------- */
function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="disc">
          Live console. The registry, ledger, hero position and guard all read <b>real on-chain data</b> from
          X Layer 196. The kill-shot fires a <b>real</b> challenge transaction — it can only slash when the
          contract independently confirms divergence.
        </div>
        <div className="frow">
          <span>Verita · staked oracle &amp; liquidation guard · X Layer 196</span>
          <span>On-chain proof → <a href="/proof">verify it yourself →</a></span>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <AppBar />
      <main>
        <Hero />
        <Registry />
        <Lifecycle />
        <LedgerAndGuard />
        <Developers />
        <Guarantees />
      </main>
      <Footer />
    </>
  );
}

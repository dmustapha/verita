// File: web/app/page.tsx
"use client";
import { useEffect, useState } from "react";
import { verita, STATUS } from "../lib/verita";
import { readHealthBps } from "../lib/positions";

const BORROWER = process.env.NEXT_PUBLIC_BORROWER_ADDR!;
const WTSLAX = process.env.NEXT_PUBLIC_WTSLAX!;

type View = {
  price: string; status: number; diverged: boolean;
  tradeable: boolean; feePot: string; healthBps: string;
};

async function load(): Promise<View> {
  const v = verita();
  const a = await v.attestations(WTSLAX);            // [price,status,timestamp,expiry,attester,diverged]
  const tradeable = await v.isTradeable(WTSLAX);
  const feePot = await v.feePot();
  const healthBps = await readHealthBps(BORROWER);
  return {
    price: (Number(a.price) / 1e8).toFixed(2),
    status: Number(a.status),
    diverged: a.diverged,
    tradeable,
    feePot: (Number(feePot) / 1e6).toFixed(4),      // USDG 6dp
    healthBps: healthBps === 0n ? "—" : (Number(healthBps) / 100).toFixed(1) + "%",
  };
}

export default function Home() {
  const [v, setV] = useState<View | null>(null);
  const [killing, setKilling] = useState(false);
  const [killTx, setKillTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load().then(setV).catch((e) => setErr(String(e)));
    const t = setInterval(() => load().then(setV).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  async function killShot() {
    setKilling(true); setErr(null);
    try {
      const r = await fetch("/api/killshot", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setKillTx(j.txHash);
      await load().then(setV);
    } catch (e) { setErr(String(e)); }
    finally { setKilling(false); }
  }

  if (err && !v) return (
    <main className="wrap">
      <div className="card card--warn">
        <h2>Can&apos;t reach X Layer 196 yet</h2>
        <p className="muted">Live chain reads aren&apos;t resolving. This is expected before the contracts are deployed and the console env is filled in.</p>
        <details><summary>Technical detail</summary><pre className="code">{err}</pre></details>
      </div>
    </main>
  );
  if (!v) return (
    <main className="wrap">
      <div className="card">
        <div className="skeleton skeleton--title" />
        <div className="skeleton" />
        <div className="skeleton" />
        <p className="muted" style={{ marginTop: 12 }}>Loading the live position from X Layer 196…</p>
      </div>
    </main>
  );

  const safe = v.tradeable && !v.diverged;
  return (
    <main className="wrap">
      <header className="hero">
        <h1>Verita</h1>
        <p className="muted">Staked accountability for tokenized-equity prices, and the market status no feed will tell you. Live on X Layer 196.</p>
      </header>

      <section className="card">
        <h2>wTSLAx — reference position</h2>
        <div className="rows">
          <div className="row"><span className="label">Attested mark</span><strong>${v.price}</strong></div>
          <div className="row"><span className="label">Market status</span><strong>{STATUS[v.status]}</strong></div>
          <div className="row"><span className="label">Health factor</span><strong>{v.healthBps}</strong></div>
          <div className="row">
            <span className="label">Verdict</span>
            <strong className={safe ? "verdict verdict--safe" : "verdict verdict--refused"}>
              {safe ? "SAFE — mark accepted" : "REFUSED — mark rejected (unsafe)"}
            </strong>
          </div>
          <div className="row"><span className="label">Per-read fees collected (feePot)</span><strong>{v.feePot} USDG</strong></div>
        </div>
      </section>

      <section className="card">
        <h2>Run the kill-shot</h2>
        <p className="muted">Submit an independent signed report that proves the attester lied. If it does, their staked USDG is slashed to the harmed borrower — on-chain, no keys on your machine.</p>
        <button onClick={killShot} disabled={killing} className="btn">
          {killing ? "Running…" : "Run the kill-shot"}
        </button>
        {killTx && <p className="ok">Slash tx: <a href={`https://www.oklink.com/xlayer/tx/${killTx}`} target="_blank" rel="noreferrer">{killTx}</a></p>}
        {err && v && <p className="bad">{err}</p>}
      </section>

      <details className="card details">
        <summary>Technical detail</summary>
        <p className="muted">Prices/status enter via authorized EIP-712 ReporterReports. A within-band report cannot slash; an
        independent report proving &gt;0.5% divergence (or a status contradiction) slashes the attester&apos;s staked
        USDG to the harmed borrower. We never call the dead on-chain Chainlink verifier.</p>
      </details>

      <p className="footlink"><a href="/proof">On-chain proof →</a></p>
    </main>
  );
}

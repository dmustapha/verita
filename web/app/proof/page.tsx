// File: web/app/proof/page.tsx
const V = process.env.NEXT_PUBLIC_VERITA || "";
const G = process.env.NEXT_PUBLIC_GUARD || "";
const USDG = "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8";
const WTSLAX = "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171";
const ok = (a: string) => `https://www.oklink.com/xlayer/address/${a}`;

function Addr({ label, a }: { label: string; a: string }) {
  if (!a) return <li>{label}: <span className="muted">pending deploy</span></li>;
  return <li>{label}: <a href={ok(a)} target="_blank" rel="noreferrer"><code>{a}</code></a></li>;
}

export default function Proof() {
  const reResolve =
`cast logs --address ${V || "<VERITA>"} "Slashed(address,address,address,uint256,string)" --rpc-url https://rpc.xlayer.tech
cast call ${USDG} "balanceOf(address)(uint256)" <BORROWER> --rpc-url https://rpc.xlayer.tech`;
  return (
    <main className="wrap">
      <header className="hero">
        <h1>On-Chain Verification</h1>
        <p className="muted">Everything Verita claims is on public X Layer 196. Re-resolve it yourself — none of our infrastructure involved.</p>
      </header>

      <section className="card">
        <h2>Contracts</h2>
        <ul className="list">
          <Addr label="Verita" a={V} />
          <Addr label="LiquidationGuard" a={G} />
          <Addr label="USDG (6dp)" a={USDG} />
          <Addr label="wTSLAx" a={WTSLAX} />
          <li>Chainlink VerifierProxy (DEAD — reverts VerifierNotFound; we never call it): <code>0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7</code></li>
        </ul>
      </section>

      <section className="card">
        <h2>Re-resolve the slash against public state</h2>
        <p className="muted">Paste these into any terminal with <code>cast</code>. They recompute the slash from public chain state, using zero of our infrastructure.</p>
        <pre className="code">{reResolve}</pre>
        <p className="muted">Transaction hashes (attest / read+fee / refused liquidation / challenge+slash) are listed in <code>submission/proof.md</code> in the repo.</p>
      </section>

      <p className="footlink"><a href="/">← Back to console</a></p>
    </main>
  );
}

// File: web/app/proof/page.tsx Graphite restyle. Addresses + re-resolve commands unchanged.
const V = process.env.NEXT_PUBLIC_VERITA || "";
const G = process.env.NEXT_PUBLIC_GUARD || "";
// USDG is the designed-for settlement token; the live mainnet proof settled in WOKB (AMEND-3).
// The re-resolve command derives the ACTUAL settlement token from the contract so it is never wrong.
const USDG = "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8";
const WOKB = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";
const WTSLAX = "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171";
const DEAD = "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7";
const ok = (a: string) => `https://www.oklink.com/xlayer/address/${a}`;

function KV({ label, a, span, dead }: { label: string; a: string; span?: boolean; dead?: boolean }) {
  return (
    <div className="kv" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <div className="k">{label}</div>
      <div className={"val" + (dead ? " dead" : "")}>
        {a ? <a href={ok(a)} target="_blank" rel="noreferrer">{a}</a> : <span style={{ color: "var(--faint)" }}>pending deploy</span>}
      </div>
    </div>
  );
}

export default function Proof() {
  const reResolve =
`cast logs --address ${V || "<VERITA>"} "Slashed(address,address,address,uint256,string)" --rpc-url https://rpc.xlayer.tech
# settlement token is a constructor param, read it from the contract, then confirm the borrower received the slash:
TOKEN=$(cast call ${V || "<VERITA>"} "USDG()(address)" --rpc-url https://rpc.xlayer.tech)
cast call $TOKEN "balanceOf(address)(uint256)" <BORROWER> --rpc-url https://rpc.xlayer.tech`;

  return (
    <>
      <header className="bar">
        <div className="wordmark"><span className="dot" />Verita</div>
        <span className="pill"><span className="b" />X Layer · 196</span>
        <nav className="nav" aria-label="Primary"><a href="/">← Console</a></nav>
      </header>
      <main>
        <section id="proof">
          <div className="wrap">
            <div className="shead">
              <div className="kicker">Verify it yourself · none of our infrastructure involved</div>
              <h2>On-chain proof</h2>
              <p>Every address and slash is public on X Layer 196. Re-resolve the slash straight from the contract, with no Verita server in the loop.</p>
            </div>

            <div className="proof-grid">
              <KV label="Verita contract" a={V} />
              <KV label="LiquidationGuard" a={G} />
              <KV label="WOKB (live settlement token, 18 dec)" a={WOKB} />
              <KV label="USDG (designed-for settlement token, 6 dec)" a={USDG} />
              <KV label="wTSLAx" a={WTSLAX} />
              <KV label="Dead Chainlink verifier Verita replaces · VerifierProxy" a={DEAD} span dead />
            </div>

            <div className="codeblock">
              <pre>{reResolve}</pre>
            </div>

            <details>
              <summary>Why re-resolve from the contract, not a hardcoded token?</summary>
              <div className="dbody">
                The settlement token is a constructor param. The command reads <code>USDG()</code> from the
                contract to get the actual token, so the borrower&apos;s balance check is never pointed at the
                wrong asset. The dead verifier <code>{DEAD}</code> reverts <code>VerifierNotFound (0xb151802b)</code>:
                Verita never calls it.
              </div>
            </details>

            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 16 }}>
              Transaction hashes (attest / read+fee / refused liquidation / challenge+slash) are listed in{" "}
              <code style={{ fontFamily: "var(--mono)", color: "var(--amber)" }}>submission/proof.md</code> in the repo.
            </p>

            <p className="footlink"><a href="/">← Back to console</a></p>
          </div>
        </section>
      </main>
    </>
  );
}

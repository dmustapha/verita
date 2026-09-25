// File: web/lib/registry.ts
// Real reads: the four attested assets on X Layer 196. Each row is resolved live from the
// Verita contract — attested price, latch status, divergence flag, tradeability, attester,
// and the stake locked behind the attester for that specific asset.
import { formatUnits } from "ethers";
import { verita, settlementToken, STATUS } from "./verita";

export type RegistryRow = {
  ticker: string;
  address: string;
  price: string;        // USD, 8dp source
  statusLabel: string;
  diverged: boolean;
  tradeable: boolean;
  attester: string;
  stakeBehind: string;  // settlement-token amount, formatted
  stakeSymbol: string;
};

export const REGISTRY_ASSETS: { ticker: string; token: string; address: string }[] = [
  { ticker: "TSLA", token: "wTSLAx", address: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171" },
  { ticker: "NVDA", token: "wNVDAx", address: "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5" },
  { ticker: "SPY",  token: "wSPYx",  address: "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540" },
  { ticker: "AAPL", token: "wAAPLx", address: "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f" },
];

export async function readRegistry(): Promise<RegistryRow[]> {
  const v = verita();
  const tok = await settlementToken();
  const rows = await Promise.all(
    REGISTRY_ASSETS.map(async (a) => {
      const [att, tradeable, locked] = await Promise.all([
        v.attestations(a.address),
        v.isTradeable(a.address).catch(() => false),
        v.attestations(a.address).then((x: any) =>
          v.lockedForAsset(x.attester, a.address).catch(() => 0n)
        ),
      ]);
      return {
        ticker: a.ticker,
        address: a.address,
        price: (Number(att.price) / 1e8).toFixed(2),
        statusLabel: STATUS[Number(att.status)] ?? "UNKNOWN",
        diverged: Boolean(att.diverged),
        tradeable: Boolean(tradeable),
        attester: String(att.attester),
        stakeBehind: Number(formatUnits(locked, tok.decimals)).toFixed(3),
        stakeSymbol: tok.symbol,
      } as RegistryRow;
    })
  );
  return rows;
}

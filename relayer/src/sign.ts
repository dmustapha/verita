// File: relayer/src/sign.ts
import { Wallet, TypedDataDomain } from "ethers";

const types = {
  ReporterReport: [
    { name: "asset", type: "address" },
    { name: "price", type: "uint256" },
    { name: "status", type: "uint8" },
    { name: "timestampNs", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
};

export async function signReport(
  wallet: Wallet, verita: string, asset: string, price8dp: bigint, status: number, nonce: bigint
) {
  const domain: TypedDataDomain = { name: "Verita", version: "1", chainId: 196, verifyingContract: verita };
  const timestampNs = BigInt(Date.now()) * 1_000_000n;
  const value = { asset, price: price8dp, status, timestampNs, nonce };
  const sig = await wallet.signTypedData(domain, types, value);
  return { asset, price: price8dp, status, timestampNs, nonce, sig };
}

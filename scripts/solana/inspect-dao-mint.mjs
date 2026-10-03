// Read-only: no signer, key material, or transaction submission.
import { address } from "@solana/kit";
import { inspectDaoMint } from "../../lib/solana/dao-mint.mjs";
const [cluster, mint] = process.argv.slice(2);
const networks = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};
if (!Object.hasOwn(networks, cluster))
  throw Error(
    "Usage: inspect-dao-mint.mjs <devnet|testnet|mainnet-beta> <mint>",
  );
address(mint);
async function rpc(method, params = []) {
  const response = await fetch(`https://api.${cluster}.solana.com`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.error || body.result === undefined)
    throw Error("RPC inspection unavailable");
  return body.result;
}
if ((await rpc("getGenesisHash")) !== networks[cluster])
  throw Error("Wrong genesis");
const result = await rpc("getAccountInfo", [
  mint,
  { encoding: "base64", commitment: "finalized" },
]);
const inspection = inspectDaoMint(
  result.value && {
    ...result.value,
    data: Buffer.from(result.value.data[0], "base64"),
  },
  mint,
);
console.log(
  JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      cluster,
      mint,
      slot: result.context.slot,
      ...inspection,
    },
    null,
    2,
  ),
);
if (!inspection.compatible) process.exitCode = 2;

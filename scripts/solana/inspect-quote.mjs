// Read-only mainnet inspection; no signer, transaction construction or secret inputs.
import { writeFile } from "node:fs/promises";
import {
  EACC_MINT,
  DAMM_V2,
  validateQuoteMint,
} from "../../lib/solana/venue-policy.mjs";
async function rpc(method, params = []) {
  const response = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  if (!response.ok || body.error || body.result === undefined)
    throw Error("Reference RPC unavailable.");
  return body.result;
}
if (
  (await rpc("getGenesisHash")) !==
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
)
  throw Error("Unexpected mainnet reference genesis.");
const result = await rpc("getAccountInfo", [
  EACC_MINT,
  { encoding: "jsonParsed", commitment: "finalized" },
]);
const inspection = {
  observedAt: new Date().toISOString(),
  slot: result.context.slot,
  commitment: "finalized",
  venue: DAMM_V2,
  ...validateQuoteMint(EACC_MINT, result.value),
  limitations: [
    "Source compatibility does not verify the deployed venue binary.",
    "No pool, position, price, liquidity depth or fee receipt has been verified.",
  ],
};
await writeFile(
  "docs/EACC_MINT_INSPECTION.json",
  JSON.stringify(inspection, null, 2) + "\n",
);
console.log(JSON.stringify(inspection, null, 2));

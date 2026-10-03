import { readFile } from "node:fs/promises";
import { inspectLiveDaoRelease } from "../../lib/solana/dao-live-release.mjs";
import { solanaNetwork } from "../../lib/solana/network.mjs";
const path = process.argv[2];
if (!path)
  throw Error("Usage: inspect-dao-release.mjs <reviewed-release.json>");
const release = JSON.parse(await readFile(path, "utf8"));
const network = solanaNetwork(release.cluster);
async function rpc(method, params) {
  const response = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.error || body.result === undefined)
    throw Error("Release RPC unavailable");
  return body.result;
}
console.log(
  JSON.stringify(await inspectLiveDaoRelease({ rpc, release }), null, 2),
);

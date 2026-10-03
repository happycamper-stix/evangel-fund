// Read-only mainnet observation for local VM testing. No signer or broadcast.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getAddressDecoder } from "@solana/kit";
import { DAMM_V2 } from "../../lib/solana/venue-policy.mjs";
import { LOADER, pda, pub } from "../../lib/solana/program.mjs";
async function rpc(method, params = []) {
  const response = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.error || body.result === undefined)
    throw Error("Venue reference RPC unavailable");
  return body.result;
}
if (
  (await rpc("getGenesisHash")) !==
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
)
  throw Error("Wrong reference cluster");
const programData = await pda(LOADER, pub(DAMM_V2.program));
const result = await rpc("getMultipleAccounts", [
  [DAMM_V2.program, programData],
  { encoding: "base64", commitment: "finalized" },
]);
const [program, data] = result.value;
if (
  !program ||
  !data ||
  program.owner !== LOADER ||
  data.owner !== LOADER ||
  !program.executable ||
  data.executable
)
  throw Error("Invalid venue loader accounts");
const p = Buffer.from(program.data[0], "base64"),
  d = Buffer.from(data.data[0], "base64");
if (
  p.length !== 36 ||
  p.readUInt32LE(0) !== 2 ||
  getAddressDecoder().decode(p.subarray(4)) !== programData ||
  d.length <= 45 ||
  d.readUInt32LE(0) !== 3 ||
  d[12] > 1
)
  throw Error("Invalid venue deployment");
const binary = d.subarray(45);
if (binary.subarray(0, 4).toString("hex") !== "7f454c46")
  throw Error("Missing ELF executable");
const report = {
  observedAt: new Date().toISOString(),
  cluster: "mainnet-beta",
  commitment: "finalized",
  slot: result.context.slot,
  program: DAMM_V2.program,
  programData,
  loader: LOADER,
  deployedSlot: d.readBigUInt64LE(4).toString(),
  upgradeAuthority:
    d[12] === 1 ? getAddressDecoder().decode(d.subarray(13, 45)) : null,
  binarySha256: createHash("sha256").update(binary).digest("hex"),
  binaryLength: binary.length,
  sourceRevision: DAMM_V2.revision,
  sourceBinaryEquivalenceVerified: false,
  adapterEnabled: false,
};
if (!process.argv.includes("--observe")) {
  const pinned = JSON.parse(
    await readFile("docs/DAMM_VENUE_INSPECTION.json", "utf8"),
  );
  if (
    report.binarySha256 !== pinned.binarySha256 ||
    report.program !== pinned.program ||
    report.programData !== pinned.programData
  )
    throw Error(
      "Venue changed: review required before replacing the pinned observation",
    );
}
await mkdir(".evangel/references", { recursive: true });
await writeFile(
  `.evangel/references/damm-v2-${report.binarySha256}.so`,
  binary,
);
if (process.argv.includes("--observe"))
  await writeFile(
    "docs/DAMM_VENUE_INSPECTION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(JSON.stringify(report, null, 2));

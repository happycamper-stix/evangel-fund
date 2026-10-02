// Read-only download of the immutable Squads program for local integration tests.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getAddressDecoder } from "@solana/kit";
import { SQUADS } from "../../lib/solana/squads.mjs";
import { LOADER } from "../../lib/solana/program.mjs";
const path = ".evangel/references/squads-v4.so";
const expected =
  "dec8d3e0fae58c7c8f2416e5f67c25e673f047afd6dd2bba4a47e0b29a01d34c";
const digest = (b) => createHash("sha256").update(b).digest("hex");
try {
  if (digest(await readFile(path)) === expected) {
    console.log("Verified cached immutable Squads binary");
    process.exit(0);
  }
} catch {}
async function read(address) {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [address, { encoding: "base64", commitment: "finalized" }],
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.result?.value)
    throw Error("Public reference RPC unavailable");
  return j.result.value;
}
const program = await read(SQUADS),
  bytes = Buffer.from(program.data[0], "base64");
if (
  program.owner !== LOADER ||
  !program.executable ||
  bytes.readUInt32LE() !== 2
)
  throw Error("Wrong loader program");
const data = await read(getAddressDecoder().decode(bytes.subarray(4, 36))),
  d = Buffer.from(data.data[0], "base64");
if (data.owner !== LOADER || d.readUInt32LE() !== 3 || d[12] !== 0)
  throw Error("Squads is not immutable");
const binary = d.subarray(45);
if (digest(binary) !== expected)
  throw Error("Reference binary changed; requires review");
await mkdir(".evangel/references", { recursive: true });
await writeFile(path, binary);
console.log("Verified and downloaded immutable Squads binary");

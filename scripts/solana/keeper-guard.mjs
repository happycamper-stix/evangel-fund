import { readFile } from "node:fs/promises";
import { getAddressDecoder } from "@solana/kit";
import { NETWORK, rpc, signer } from "./runtime.mjs";
import { LOADER, pda, pub } from "../../lib/solana/program.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import { governanceDrift } from "../../lib/solana/governance-baseline.mjs";
export const MIN_KEEPER_LAMPORTS = 20_000_000,
  MAX_KEEPER_LAMPORTS = 250_000_000,
  MAX_KEEPER_TRANSACTIONS = 10;
export function assertKeeperBalance(balance) {
  if (
    !Number.isSafeInteger(balance) ||
    balance < MIN_KEEPER_LAMPORTS ||
    balance > MAX_KEEPER_LAMPORTS
  )
    throw Error(
      "Keeper balance must be between 0.02 and 0.25 development SOL. No transaction signed.",
    );
}
export async function verifyKeeperDeployment(snapshot, { venue = false } = {}) {
  const file = venue
    ? process.env.EVANGEL_VENUE_DEPLOYMENT_BASELINE
    : process.env.EVANGEL_DEPLOYMENT_BASELINE;
  if (!file)
    throw Error("An explicit reviewed deployment baseline is required.");
  const baseline = JSON.parse(await readFile(file, "utf8"));
  if (
    baseline.cluster !== NETWORK.cluster ||
    baseline.program !== snapshot.config.program ||
    !snapshot.factory ||
    governanceDrift(snapshot.governance, baseline, snapshot.config.program)
      .length
  )
    throw Error("Keeper deployment or governance mismatch.");
  if (
    venue &&
    (baseline.venueAdapter !== true ||
      baseline.venueCandidate !== false ||
      baseline.testFixtures !== false)
  )
    throw Error("Venue adapter is not approved in this deployment baseline.");
  const a = (
    await rpc("getAccountInfo", [
      await pda(LOADER, pub(baseline.program)),
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  if (!a || a.owner !== LOADER) throw Error("Program data unavailable");
  const b = Buffer.from(a.data[0], "base64");
  if (
    b.length < 45 ||
    b.readUInt32LE(0) !== 3 ||
    b[12] !== 1 ||
    getAddressDecoder().decode(b.subarray(13, 45)) !== snapshot.governance.vault
  )
    throw Error("Keeper upgrade authority mismatch");
  verifyProgramBytes(b.subarray(45), baseline);
  return baseline;
}
export async function keeperSigner() {
  const s = await signer("keeper");
  await checkKeeperBalance(s);
  return s;
}
export async function checkKeeperBalance(s) {
  assertKeeperBalance(
    (await rpc("getBalance", [s.address, { commitment: "finalized" }])).value,
  );
}

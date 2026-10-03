import { LEGACY_UPGRADE_HOLD } from "../../lib/governance/dao-policy.mjs";
if (process.argv.includes("--write")) throw Error(LEGACY_UPGRADE_HOLD);
// Promote the reviewed baseline only after exact finalized onchain code verification.
import { readFile, writeFile, rename } from "node:fs/promises";
import { upgradeStatus } from "../../lib/solana/upgrade-status.mjs";
import { solanaConfig } from "../../lib/solana/config.mjs";
import { rpc } from "../../lib/solana/state.mjs";
const load = async (name) => JSON.parse(await readFile(`docs/${name}`, "utf8"));
const baseline = await load("DEVNET_ADDRESSES.json"),
  candidate = await load("VENUE_ADAPTER_CANDIDATE.json"),
  prepared = await load("DEVNET_UPGRADE_PREPARATION.json");
const status = await upgradeStatus({
  rpc,
  config: solanaConfig(),
  baseline,
  candidate,
  prepared,
});
if (status.status !== "deployed")
  throw Error(
    "Reviewed upgrade is not finalized onchain. Baseline remains unchanged.",
  );
const promoted = {
  ...baseline,
  binarySha256: candidate.binarySha256,
  binaryLength: candidate.binaryLength,
  venueAdapter: true,
  venueCandidate: false,
  testFixtures: false,
  upgradeVerifiedAt: new Date().toISOString(),
  upgradeVerifiedSlot: status.slot,
};
if (process.argv.includes("--write")) {
  const filename = "docs/DEVNET_ADDRESSES.json";
  await writeFile(`${filename}.tmp`, JSON.stringify(promoted, null, 2) + "\n");
  await rename(`${filename}.tmp`, filename);
}
console.log(
  JSON.stringify({
    status: "verified",
    written: process.argv.includes("--write"),
    binarySha256: promoted.binarySha256,
    slot: status.slot,
  }),
);

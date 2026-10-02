// Register the user-authorized public pilot repository. Never requests adoption.
import { writeFile } from "node:fs/promises";
import {
  NETWORK,
  assertDevelopmentCluster,
  signer,
  submit,
  load,
  finalized,
} from "./runtime.mjs";
import { state } from "../../lib/solana/state.mjs";
import { pda, sha256, instruction, SYSTEM } from "../../lib/solana/program.mjs";
const source = "https://github.com/happycamper-stix/evangel-fund";
if (NETWORK.cluster !== "devnet") throw Error("This pilot is Devnet-only.");
await assertDevelopmentCluster();
const response = await fetch(
  "https://api.github.com/repos/happycamper-stix/evangel-fund",
  {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  },
);
if (!response.ok) throw Error("Cannot verify public pilot repository.");
const repo = await response.json();
if (
  repo.id !== 1402434191 ||
  repo.private ||
  repo.fork ||
  repo.full_name !== "happycamper-stix/evangel-fund"
)
  throw Error("Pilot repository identity changed.");
const before = await state();
if (!before.factory || !before.governance)
  throw Error("Verified factory/governance unavailable.");
const project = await pda(
  before.config.program,
  "project",
  await sha256(source),
);
const existing = before.projects.find((p) => p.address === project);
if (existing && (existing.source !== source || !existing.tokenless))
  throw Error("Unexpected existing project.");
const broadcast = process.argv.includes("--broadcast");
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    repository: source,
    project,
    exists: !!existing,
    broadcast,
  }),
);
if (!broadcast) process.exit(0);
let signature = null;
if (!existing) {
  const payer = await signer("operator");
  signature = await submit(
    [
      instruction(
        before.config.program,
        "registerFund",
        { name: "Evangel OSS pilot", source },
        [payer.address, before.factory.address, project, SYSTEM],
        [payer],
      ),
    ],
    payer,
    { journal: "evangel-public-pilot-registration.json" },
  );
}
if (existing) {
  try {
    const prior = await load("evangel-public-pilot-registration.json");
    await finalized(prior.signature);
    signature = prior.signature;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const after = await state();
const registered = after.projects.find((p) => p.address === project);
if (!registered || registered.source !== source || !registered.tokenless)
  throw Error("Finalized registration not verified.");
const receipt = {
  cluster: NETWORK.cluster,
  program: before.config.program,
  project,
  repository: source,
  repositoryId: repo.id,
  registrationSignature: signature,
  adopted: registered.adopted,
  owner: registered.owner,
  observedAt: new Date().toISOString(),
  note: "Registration alone does not prove repository ownership or authorize funding/adoption.",
};
// Do not overwrite an existing finalized receipt with an empty signature on a retry.
if (signature)
  await writeFile(
    "docs/PILOT_REGISTRATION.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
console.log(JSON.stringify(receipt, null, 2));

// Development-network keeper. Never assumes the public site's disabled flag is an adapter deployment.
import { readFile } from "node:fs/promises";
import { state } from "../../lib/solana/state.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import {
  collectVenueInstruction,
  venueComputeBudget,
} from "../../lib/solana/venue-client.mjs";
import {
  pda,
  pub,
  LOADER,
  SYSTEM,
  TOKEN,
  instruction,
  feeDayAddresses,
} from "../../lib/solana/program.mjs";
import {
  NETWORK,
  assertDevelopmentCluster,
  rpc,
  signer,
  signedTransaction,
  save,
  finalized,
} from "./runtime.mjs";
await assertDevelopmentCluster();
const snapshot = await state(),
  baselinePath = process.env.EVANGEL_VENUE_DEPLOYMENT_BASELINE;
if (!snapshot.factory || !baselinePath)
  throw Error(
    "A reviewed venue deployment baseline is required; no transaction submitted",
  );
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
if (
  baseline.cluster !== NETWORK.cluster ||
  baseline.program !== snapshot.config.program ||
  baseline.venueAdapter !== true ||
  baseline.testFixtures !== false ||
  baseline.venueCandidate !== false
)
  throw Error("Not a reviewed adapter deployment");
const deployment = (
  await rpc("getAccountInfo", [
    await pda(LOADER, pub(baseline.program)),
    { encoding: "base64", commitment: "finalized" },
  ])
).value;
if (!deployment || deployment.owner !== LOADER)
  throw Error("Missing loader account");
verifyProgramBytes(
  Buffer.from(deployment.data[0], "base64").subarray(45),
  baseline,
);
const slot = await rpc("getSlot", [{ commitment: "finalized" }]),
  time = await rpc("getBlockTime", [slot]);
if (!Number.isSafeInteger(time) || time < 0) throw Error("Missing chain clock");
const day = BigInt(Math.floor(time / 86400)),
  projects = snapshot.projects.filter(
    (p) => !p.tokenless && p.virtualQuote === "0",
  );
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    day: String(day),
    projects: projects.map((p) => p.address),
    broadcast: process.argv.includes("--broadcast"),
  }),
);
if (!process.argv.includes("--broadcast")) process.exit(0);
const operator = await signer("operator");
for (const project of projects) {
  const { feeDay, feeVault } = await feeDayAddresses(
      baseline.program,
      project.address,
      day,
    ),
    ix = [venueComputeBudget()];
  const existing = (
    await rpc("getAccountInfo", [
      feeDay,
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  if (!existing)
    ix.push(
      instruction(
        baseline.program,
        "initializeFeeDay",
        { day },
        [
          operator.address,
          snapshot.factory.address,
          project.address,
          feeDay,
          feeVault,
          snapshot.factory.quoteMint,
          SYSTEM,
          TOKEN,
        ],
        [operator],
      ),
    );
  ix.push(
    await collectVenueInstruction({
      program: baseline.program,
      caller: operator,
      project: project.address,
      mint: project.mint,
      quoteMint: snapshot.factory.quoteMint,
      day,
    }),
  );
  const tx = await signedTransaction(ix, operator);
  await save(`venue-collect-${tx.signature}.json`, tx);
  const returned = await rpc("sendTransaction", [
    tx.wire,
    { encoding: "base64", skipPreflight: false, maxRetries: 3 },
  ]);
  if (returned !== tx.signature)
    throw Error("Unexpected transaction signature");
  await finalized(tx.signature);
  const signature = tx.signature;
  console.log(
    JSON.stringify({
      project: project.address,
      day: String(day),
      signature,
      status: "finalized",
    }),
  );
}

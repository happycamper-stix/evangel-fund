// Development-network keeper. Never assumes the public site's disabled flag is an adapter deployment.
import {
  verifyKeeperDeployment,
  keeperSigner,
  checkKeeperBalance,
  MAX_KEEPER_TRANSACTIONS,
} from "./keeper-guard.mjs";
import { state } from "../../lib/solana/state.mjs";
import {
  collectVenueInstruction,
  venueComputeBudget,
} from "../../lib/solana/venue-client.mjs";
import {
  SYSTEM,
  TOKEN,
  instruction,
  feeDayAddresses,
} from "../../lib/solana/program.mjs";
import {
  NETWORK,
  assertDevelopmentCluster,
  rpc,
  signedTransaction,
  save,
  finalized,
} from "./runtime.mjs";
await assertDevelopmentCluster();
const snapshot = await state();
const baseline = await verifyKeeperDeployment(snapshot, { venue: true });
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
if (!projects.length) process.exit(0);
if (projects.length > MAX_KEEPER_TRANSACTIONS)
  throw Error(
    "Collection batch exceeds the reviewed limit; partition projects before enabling this keeper.",
  );
const operator = await keeperSigner();
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
  await checkKeeperBalance(operator);
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

import {
  verifyKeeperDeployment,
  keeperSigner,
  checkKeeperBalance,
  MAX_KEEPER_TRANSACTIONS,
} from "./keeper-guard.mjs";
import { NETWORK } from "./runtime.mjs";
// Run daily after 00:00 UTC. Permissionless settlement; operator only pays network rent/fees.
import { getCreateAssociatedTokenIdempotentInstruction } from "@solana-program/token-2022";
import { state } from "../../lib/solana/state.mjs";
import { dailySettlementPlan } from "../../lib/solana/settlement.mjs";
import {
  feeDayAddresses,
  instruction,
  pda,
  pub,
  TOKEN,
} from "../../lib/solana/program.mjs";
import {
  assertDevelopmentCluster,
  signedTransaction,
  save,
  rpc,
  finalized,
} from "./runtime.mjs";
await assertDevelopmentCluster();
const snapshot = await state();
if (!snapshot.factory) {
  console.log(
    JSON.stringify({
      status: "pending",
      reason: "No verified factory configured; nothing submitted",
    }),
  );
  process.exit(0);
}
await verifyKeeperDeployment(snapshot);
const slot = await rpc("getSlot", [{ commitment: "finalized" }]);
const now = await rpc("getBlockTime", [slot]);
const plan = dailySettlementPlan(snapshot, now);
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    plan,
    broadcast: process.argv.includes("--broadcast"),
  }),
);
if (!process.argv.includes("--broadcast") || !plan.length) process.exit(0);
if (plan.length > MAX_KEEPER_TRANSACTIONS)
  throw Error(
    "Settlement batch exceeds the reviewed limit; partition days before enabling this keeper.",
  );
const operator = await keeperSigner();
let failures = 0;
for (const step of plan) {
  try {
    const args = { day: BigInt(step.day) },
      ix = [];
    const call = (name, accounts) =>
      instruction(
        snapshot.config.program,
        name,
        args,
        [operator.address, snapshot.factory.address, ...accounts],
        [operator],
      );
    if (step.settle) ix.push(call("settleFeeDay", [step.project, step.feeDay]));
    if (BigInt(step.developmentClaim) > 0n) {
      const ataProgram = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
      const destination = await pda(
        ataProgram,
        pub(step.developmentRecipient),
        pub(TOKEN),
        pub(snapshot.factory.quoteMint),
      );
      const { feeVault } = await feeDayAddresses(
        snapshot.config.program,
        step.project,
        BigInt(step.day),
      );
      ix.push(
        getCreateAssociatedTokenIdempotentInstruction(
          {
            payer: operator,
            ata: destination,
            owner: step.developmentRecipient,
            mint: snapshot.factory.quoteMint,
          },
          { programAddress: ataProgram },
        ),
      );
      ix.push(
        call("claimDevelopment", [
          step.project,
          step.feeDay,
          feeVault,
          snapshot.factory.quoteMint,
          destination,
          TOKEN,
        ]),
      );
    }
    await checkKeeperBalance(operator);
    const tx = await signedTransaction(ix, operator);
    await save(`daily-${tx.signature}.json`, tx);
    const returned = await rpc("sendTransaction", [
      tx.wire,
      { encoding: "base64", skipPreflight: false, maxRetries: 3 },
    ]);
    if (returned !== tx.signature)
      throw Error("Unexpected transaction signature");
    await finalized(tx.signature);
    console.log(
      JSON.stringify({
        feeDay: step.feeDay,
        signature: tx.signature,
        status: "finalized",
      }),
    );
  } catch {
    failures++;
    console.error(
      JSON.stringify({
        feeDay: step.feeDay,
        status: "retry-required",
        reason:
          "Settlement not confirmed. Inspect the signed-attempt journal and finalized account state before rerunning.",
      }),
    );
  }
}
if (failures) process.exitCode = 1;

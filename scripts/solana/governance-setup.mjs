import { NETWORK } from "./runtime.mjs";
// Devnet/testnet only. No mainnet creation, signing keys or independent reviewers are invented.
import { address } from "@solana/kit";
import {
  assertDevelopmentCluster,
  rpc,
  signer,
  submit,
  save,
} from "./runtime.mjs";
import {
  SQUADS,
  FOUNDATION,
  createMultisig,
  programConfigAddress,
  squadAddress,
  decodeMultisig,
  assertSafeMultisig,
} from "../../lib/solana/squads.mjs";
import { Reader } from "../../lib/solana/program.mjs";
const args = process.argv.slice(2),
  reviewers = args.filter((s) => !s.startsWith("--"));
if (reviewers.length !== 2)
  throw Error("Provide two independent public reviewer addresses. No keys.");
reviewers.forEach(address);
if (new Set([FOUNDATION, ...reviewers]).size !== 3)
  throw Error("Reviewers must be distinct and different from the foundation");
await assertDevelopmentCluster();
const creator = await signer("operator"),
  createKey = await signer("governance-create");
const multisig = await squadAddress(createKey.address);
const existing = (
  await rpc("getAccountInfo", [
    multisig,
    { encoding: "base64", commitment: "finalized" },
  ])
).value;
if (existing) {
  const s = assertSafeMultisig(
    await decodeMultisig(multisig, {
      owner: existing.owner,
      data: new Uint8Array(Buffer.from(existing.data[0], "base64")),
    }),
  );
  if (
    JSON.stringify(s.members.map((m) => m.address).sort()) !==
    JSON.stringify([FOUNDATION, ...reviewers].sort())
  )
    throw Error("Existing multisig members differ");
  console.log(JSON.stringify(s));
  process.exit(0);
}
const a = (
  await rpc("getAccountInfo", [
    await programConfigAddress(),
    { encoding: "base64", commitment: "finalized" },
  ])
).value;
if (!a || a.owner !== SQUADS)
  throw Error(
    "Official Squads configuration unavailable on the selected development network",
  );
const r = new Reader(new Uint8Array(Buffer.from(a.data[0], "base64")));
r.take(8);
r.pub();
const creationFee = r.u64(),
  treasury = r.pub();
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    multisig,
    members: [FOUNDATION, ...reviewers],
    threshold: 2,
    timelockSeconds: 172800,
    creationFeeLamports: creationFee,
    broadcast: args.includes("--broadcast"),
  }),
);
if (args.includes("--broadcast")) {
  const signature = await submit(
    [
      await createMultisig({
        creator,
        createKey,
        treasury,
        members: [FOUNDATION, ...reviewers],
      }),
    ],
    creator,
    { journal: "governance-create.json" },
  );
  await save("governance.json", {
    multisig,
    members: [FOUNDATION, ...reviewers],
    signature,
  });
  console.log(
    "Finalized Squads creation. Set EVANGEL_GOVERNANCE_MULTISIG to the public multisig address.",
  );
}

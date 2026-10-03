// Disposable Devnet setup only. Never initializes or transfers the existing factory.
import { readFile, writeFile } from "node:fs/promises";
import { getAddressDecoder } from "@solana/kit";
import {
  NETWORK,
  rpc,
  signer,
  submit,
  assertDevelopmentCluster,
  save,
  ROOT,
} from "./runtime.mjs";
import { writeUpgradeBuffer } from "./write-upgrade-buffer.mjs";
import { TOKEN, LOADER, SYSTEM, pda, pub } from "../../lib/solana/program.mjs";
import {
  daoAddress,
  daoAuthority,
  daoInstruction,
} from "../../lib/solana/dao.mjs";
import {
  reviewerContext,
  verifyReviewerProof,
} from "../../lib/governance/reviewer-proof.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import { inspectDaoMint } from "../../lib/solana/dao-mint.mjs";
import { inspectLiveDaoRelease } from "../../lib/solana/dao-live-release.mjs";
import {
  rehearsalMintInstructions,
  rehearsalAllocationInstructions,
  rehearsalTokenAccount,
  revokeRehearsalMint,
  loaderAuthorityInstruction,
  deployRehearsalTargetInstructions,
  REHEARSAL_SUPPLY,
} from "../../lib/solana/rehearsal-setup.mjs";
if (NETWORK.cluster !== "devnet") throw Error("Rehearsal requires Devnet");
await assertDevelopmentCluster();
const release = JSON.parse(
  await readFile("docs/DAO_RELEASE_CANDIDATE.json", "utf8"),
);
const context = reviewerContext(release);
for (const wallet of [context.developer, ...context.reviewers])
  await verifyReviewerProof(
    context,
    JSON.parse(
      await readFile(`.evangel/reviewer-proofs/${wallet}.json`, "utf8"),
    ),
  );
const payer = await signer("operator"),
  target = await signer("dao-rehearsal-target"),
  buffer = await signer("dao-rehearsal-buffer"),
  mint = await signer("dao-rehearsal-mint");
const baseline = JSON.parse(
  await readFile("docs/DEVNET_ADDRESSES.json", "utf8"),
);
if (
  target.address === baseline.program ||
  target.address === release.devnetProgram
)
  throw Error("Disposable target separation failed");
const bytes = await readFile(".evangel/dao-programs/evangel_dao.so");
verifyProgramBytes(bytes, release.production);
const key = (b) => getAddressDecoder().decode(b);
async function account(address) {
  const a = (
    await rpc("getAccountInfo", [
      address,
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  return a && { ...a, data: Buffer.from(a.data[0], "base64") };
}
async function inspectProgram(program, artifact) {
  const pd = await pda(LOADER, pub(program)),
    pa = await account(program),
    da = await account(pd);
  if (
    pa?.owner !== LOADER ||
    !pa.executable ||
    pa.data.length !== 36 ||
    pa.data.readUInt32LE(0) !== 2 ||
    key(pa.data.subarray(4)) !== pd ||
    da?.owner !== LOADER ||
    da.executable ||
    da.data.length < 45 ||
    da.data.readUInt32LE(0) !== 3 ||
    ![0, 1].includes(da.data[12])
  )
    throw Error("Unexpected loader program state");
  verifyProgramBytes(da.data.subarray(45), artifact);
  return {
    pd,
    authority: da.data[12] === 1 ? key(da.data.subarray(13, 45)) : null,
  };
}
async function checkFactory() {
  const pd = await pda(LOADER, pub(baseline.program)),
    a = await account(pd);
  if (
    a?.owner !== LOADER ||
    a.data.readUInt32LE(0) !== 3 ||
    a.data[12] !== 1 ||
    key(a.data.subarray(13, 45)) !== baseline.authority
  )
    throw Error("Existing factory authority drift");
}
await checkFactory();
let guard = await inspectProgram(release.devnetProgram, release.production);
if (guard.authority !== null && guard.authority !== payer.address)
  throw Error("Guard authority changed");
console.log(
  JSON.stringify({
    cluster: "devnet",
    guard: release.devnetProgram,
    target: target.address,
    mint: mint.address,
    reviewers: release.reviewers,
    verifiedWalletProofs: 4,
    balanceLamports: (await rpc("getBalance", [payer.address])).value,
  }),
);
if (!process.argv.includes("--broadcast")) process.exit(0);
const signatures = {};
if (!(await account(target.address))) {
  const staged = await account(buffer.address);
  if (
    staged &&
    (staged.owner !== LOADER ||
      staged.data.length !== bytes.length + 37 ||
      staged.data.readUInt32LE(0) !== 1 ||
      staged.data[4] !== 1 ||
      key(staged.data.subarray(5, 37)) !== payer.address)
  )
    throw Error("Wrong rehearsal buffer");
  const rent = await rpc("getMinimumBalanceForRentExemption", [
    bytes.length + 37,
  ]);
  await writeUpgradeBuffer({
    bytes,
    buffer,
    payer,
    staged,
    rent,
    createJournal: "dao-rehearsal-buffer-create.json",
  });
  const written = await account(buffer.address);
  verifyProgramBytes(written.data.subarray(37), release.production);
  signatures.deployTarget = await submit(
    await deployRehearsalTargetInstructions({
      payer,
      target,
      buffer: buffer.address,
      rent: await rpc("getMinimumBalanceForRentExemption", [36]),
      length: bytes.length * 2,
    }),
    payer,
    { journal: "dao-rehearsal-deploy-target.json" },
  );
}
const targetState = await inspectProgram(target.address, release.production);
const config = await daoAddress(release.devnetProgram, target.address),
  authority = await daoAuthority(release.devnetProgram, config);
if (![payer.address, authority].includes(targetState.authority))
  throw Error("Unexpected disposable target authority");
let ma = await account(mint.address);
if (!ma) {
  signatures.createMint = await submit(
    rehearsalMintInstructions({
      payer,
      mint,
      rent: await rpc("getMinimumBalanceForRentExemption", [1000]),
    }),
    payer,
    { journal: "dao-rehearsal-create-mint.json" },
  );
  ma = await account(mint.address);
}
if (
  ma.owner !== TOKEN ||
  ma.data.length < 82 ||
  ma.data[44] !== 6 ||
  ma.data[45] !== 1
)
  throw Error("Wrong rehearsal mint");
const participants = [release.developer, ...release.reviewers],
  allocations = [];
for (const [i, owner] of participants.entries()) {
  const amount = i === 0 ? 4_200_000_000_000n : 5_600_000_000_000n,
    ata = await rehearsalTokenAccount(mint.address, owner);
  // Journaled transactions are replay-safe; once deposited an ATA may be below its initial allocation.
  signatures[`allocation${i}`] = await submit(
    await rehearsalAllocationInstructions({
      payer,
      mint: mint.address,
      owner,
      amount,
    }),
    payer,
    { journal: `dao-rehearsal-allocation-${i}.json` },
  );
  allocations.push({
    owner,
    associatedAccount: ata,
    initialAmount: amount.toString(),
    devnetSolLamports: 20000000,
  });
}
signatures.revokeMint = await submit(
  [revokeRehearsalMint(mint.address, payer)],
  payer,
  { journal: "dao-rehearsal-revoke-mint.json" },
);
ma = await account(mint.address);
const inspectedMint = inspectDaoMint(ma, mint.address);
if (
  !inspectedMint.compatible ||
  inspectedMint.supply !== REHEARSAL_SUPPLY.toString()
)
  throw Error("Dummy mint validation failed");
// Irreversible only for the reviewed guard; it has no factory authority.
if (guard.authority !== null) {
  signatures.freezeGuard = await submit(
    [loaderAuthorityInstruction(guard.pd, payer, null)],
    payer,
    { journal: "dao-rehearsal-freeze-guard.json" },
  );
  guard = await inspectProgram(release.devnetProgram, release.production);
  if (guard.authority !== null) throw Error("Guard immutability not confirmed");
}
if (!(await account(config))) {
  if (targetState.authority !== payer.address)
    throw Error("Target authority moved before initialization");
  const ro = (address) => ({ address, role: 0 }),
    rw = (address) => ({ address, role: 1 });
  signatures.initialize = await submit(
    [
      daoInstruction(
        release.devnetProgram,
        "initialize",
        {
          developer: release.developer,
          reviewers: release.reviewers,
          treasury: release.developer,
          development: false,
        },
        [
          { address: payer.address, role: 3, signer: payer },
          rw(config),
          ro(target.address),
          ro(targetState.pd),
          ro(mint.address),
          ro(SYSTEM),
          ro(guard.pd),
        ],
      ),
      loaderAuthorityInstruction(targetState.pd, payer, authority),
    ],
    payer,
    { journal: "dao-rehearsal-initialize.json" },
  );
}
// Preserve receipts for phases completed by an earlier, interrupted run.
for (const [field, phase] of Object.entries({
  deployTarget: "deploy-target",
  createMint: "create-mint",
  revokeMint: "revoke-mint",
  freezeGuard: "freeze-guard",
  initialize: "initialize",
})) {
  signatures[field] = JSON.parse(
    await readFile(`${ROOT}/dao-rehearsal-${phase}.json`, "utf8"),
  ).signature;
}
const record = {
  cluster: "devnet",
  program: release.devnetProgram,
  production: release.production,
  supply: REHEARSAL_SUPPLY.toString(),
  expected: {
    target: target.address,
    mint: mint.address,
    developer: release.developer,
    reviewers: release.reviewers,
    treasury: release.developer,
  },
  config,
  authority,
  allocations,
  signatures,
  disposable: true,
  targetPurpose:
    "Separate loader rehearsal target using the reviewed guard bytecode; no business state or factory funds",
  publicActivation: false,
};
const verified = await inspectLiveDaoRelease({ rpc, release: record });
await checkFactory();
record.verifiedAt = new Date().toISOString();
record.observedSlot = verified.slot;
record.factoryAuthorityUnchanged = baseline.authority;
await save("dao-rehearsal.json", record);
await writeFile(
  "docs/DAO_DEVNET_REHEARSAL.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: "rehearsal initialized and verified",
    target: target.address,
    mint: mint.address,
    config,
    authority,
    guardImmutable: true,
    factoryAuthorityUnchanged: baseline.authority,
  }),
);

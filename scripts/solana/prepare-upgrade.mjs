import { LEGACY_UPGRADE_HOLD } from "../../lib/governance/dao-policy.mjs";
throw Error(LEGACY_UPGRADE_HOLD);
// Stage only the pinned Devnet artifact. Never execute an upgrade or change its baseline.
import { readFile } from "node:fs/promises";
import { getAddressDecoder } from "@solana/kit";
import { writeUpgradeBuffer } from "./write-upgrade-buffer.mjs";
import {
  NETWORK,
  RPC_URL,
  assertDevelopmentCluster,
  rpc,
  signer,
  save,
  submit,
} from "./runtime.mjs";
import { upgradeActions } from "../../lib/solana/upgrade-plan.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import { LOADER, pda, pub, integer } from "../../lib/solana/program.mjs";
import {
  decodeMultisig,
  assertSafeMultisig,
} from "../../lib/solana/squads.mjs";

if (NETWORK.cluster !== "devnet")
  throw Error("This reviewed upgrade is Devnet only.");
await assertDevelopmentCluster();
const baseline = JSON.parse(await readFile("docs/DEVNET_ADDRESSES.json"));
const candidate = JSON.parse(
  await readFile("docs/VENUE_ADAPTER_CANDIDATE.json"),
);
const artifact = ".evangel/venue-release/evangel_factory.so";
const bytes = await readFile(artifact);
const build = JSON.parse(await readFile(".evangel/venue-release/build.json"));
if (
  build.version !== 3 ||
  build.testFixtures !== false ||
  build.venueCandidate !== false ||
  build.venueAdapter !== true ||
  build.binarySha256 !== candidate.binarySha256 ||
  bytes.length !== candidate.binaryLength
)
  throw Error("Not the reviewed production-mode adapter artifact.");
verifyProgramBytes(bytes, candidate);
const get = async (address) => {
  const a = (
    await rpc("getAccountInfo", [
      address,
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  return a && { ...a, data: Buffer.from(a.data[0], "base64") };
};
const decode = (b) => getAddressDecoder().decode(b);
const governance = assertSafeMultisig(
  await decodeMultisig(
    baseline.governanceMultisig,
    await get(baseline.governanceMultisig),
  ),
);
if (
  governance.vault !== baseline.authority ||
  JSON.stringify(governance.members.map((m) => m.address).sort()) !==
    JSON.stringify([...baseline.members].sort())
)
  throw Error("Governance baseline changed.");
const program = await get(baseline.program);
const programData = await pda(LOADER, pub(baseline.program));
const deployed = await get(programData);
if (
  !program?.executable ||
  program.owner !== LOADER ||
  program.data.readUInt32LE(0) !== 2 ||
  decode(program.data.subarray(4, 36)) !== programData ||
  deployed?.owner !== LOADER ||
  deployed.data.readUInt32LE(0) !== 3 ||
  deployed.data[12] !== 1 ||
  decode(deployed.data.subarray(13, 45)) !== governance.vault
)
  throw Error("Program or upgrade authority mismatch.");
verifyProgramBytes(deployed.data.subarray(45), baseline);
const payer = await signer("operator");
const buffer = await signer("venue-upgrade-buffer");
let additionalBytes = Math.max(0, bytes.length - (deployed.data.length - 45));
let extensionRent = Math.max(
  0,
  (await rpc("getMinimumBalanceForRentExemption", [
    Math.max(deployed.data.length, bytes.length + 45),
  ])) - deployed.lamports,
);
const bufferRent = await rpc("getMinimumBalanceForRentExemption", [
  bytes.length + 37,
]);
const balance = (
  await rpc("getBalance", [payer.address, { commitment: "finalized" }])
).value;
let staged = await get(buffer.address);
if (
  staged &&
  (staged.data.length !== bytes.length + 37 ||
    staged.owner !== LOADER ||
    staged.data.readUInt32LE(0) !== 1 ||
    staged.data[4] !== 1 ||
    ![payer.address, governance.vault].includes(
      decode(staged.data.subarray(5, 37)),
    ))
)
  throw Error("Unexpected buffer account or authority.");
console.log(
  JSON.stringify(
    {
      cluster: NETWORK.cluster,
      artifactVerified: true,
      buffer: buffer.address,
      additionalBytes,
      extensionRent,
      bufferRent,
      balance,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--broadcast")) {
  if (balance < (staged ? 0 : bufferRent) + 50_000_000)
    throw Error("Insufficient buffer rent plus bounded fee reserve.");
  if (!staged || decode(staged.data.subarray(5, 37)) === payer.address) {
    await writeUpgradeBuffer({
      bytes,
      buffer,
      payer,
      staged,
      rent: bufferRent,
    });
    staged = await get(buffer.address);
    if (
      !staged ||
      staged.owner !== LOADER ||
      staged.data.readUInt32LE(0) !== 1 ||
      staged.data[4] !== 1 ||
      decode(staged.data.subarray(5, 37)) !== payer.address
    )
      throw Error("Written buffer header mismatch.");
    verifyProgramBytes(staged.data.subarray(37), candidate);
    await submit(
      [
        {
          programAddress: LOADER,
          accounts: [
            { address: buffer.address, role: 1 },
            { address: payer.address, role: 2, signer: payer },
            { address: governance.vault, role: 0 },
          ],
          data: integer(4, 4),
        },
      ],
      payer,
      { journal: "venue-upgrade-buffer-transfer.json" },
    );
  }
  staged = await get(buffer.address);
}
let bufferVerified = false;
if (staged) {
  verifyProgramBytes(staged.data.subarray(37), candidate);
  bufferVerified = decode(staged.data.subarray(5, 37)) === governance.vault;
}
if (process.argv.includes("--extend")) {
  if (!process.argv.includes("--broadcast") || !bufferVerified)
    throw Error(
      "Extension requires --broadcast and a verified governance-controlled buffer.",
    );
  if (additionalBytes) {
    const extension = upgradeActions({
      program: baseline.program,
      programData,
      buffer: buffer.address,
      authority: payer.address,
      refundRecipient: payer.address,
      additionalBytes,
    })[0];
    await submit(
      [
        {
          ...extension,
          accounts: extension.accounts.map((a) =>
            a.role >= 2 ? { ...a, signer: payer } : a,
          ),
        },
      ],
      payer,
      { journal: "venue-upgrade-capacity-extension.json" },
    );
    const extended = await get(programData);
    verifyProgramBytes(extended.data.subarray(45), baseline);
    if (
      extended.data.length !== bytes.length + 45 ||
      decode(extended.data.subarray(13, 45)) !== governance.vault
    )
      throw Error("Unexpected extended account capacity or authority.");
    additionalBytes = 0;
    extensionRent = 0;
  }
}
const topLevelPreparation = additionalBytes
  ? {
      instruction: "ExtendProgram",
      additionalBytes,
      payer: payer.address,
      rentLamports: extensionRent,
      command: "npm run solana:prepare-upgrade -- --broadcast --extend",
      note: "Permissionless zero-filled capacity extension; must be top-level, not a Squads inner instruction.",
    }
  : null;
const actions = upgradeActions({
  program: baseline.program,
  programData,
  buffer: buffer.address,
  authority: governance.vault,
  refundRecipient: payer.address,
  additionalBytes: 0,
}).map(({ data, ...rest }) => ({
  ...rest,
  dataHex: Buffer.from(data).toString("hex"),
}));
const report = {
  observedAt: new Date().toISOString(),
  cluster: NETWORK.cluster,
  status: bufferVerified
    ? "buffer verified and controlled by Squads; member proposals and signatures pending"
    : "preflight only; buffer not ready",
  program: baseline.program,
  programData,
  multisig: baseline.governanceMultisig,
  vault: governance.vault,
  currentTransactionIndex: String(governance.transactionIndex),
  threshold: governance.threshold,
  timelockSeconds: governance.timeLock,
  buffer: buffer.address,
  bufferVerified,
  binarySha256: candidate.binarySha256,
  binaryLength: bytes.length,
  additionalBytes,
  extensionRentLamports: extensionRent,
  vaultBalanceLamports: (
    await rpc("getBalance", [governance.vault, { commitment: "finalized" }])
  ).value,
  refundRecipient: payer.address,
  topLevelPreparation,
  actions,
  note: "Unsigned upgrade instruction, not a submitted proposal. Complete any top-level capacity preparation first. The upgrade requires real member creation, two approvals, and its timelock. Recheck state/index and exact buffer immediately before signing. Do not change the deployed baseline until finalized upgrade bytes match.",
};
await save("venue-upgrade-preparation.json", report);
console.log(JSON.stringify(report, null, 2));

import { NETWORK, GENESIS, RPC_URL } from "./runtime.mjs";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import {
  createKeyPairSignerFromPrivateKeyBytes,
  getAddressEncoder,
} from "@solana/kit";
import {
  signer,
  rpc,
  assertDevelopmentCluster,
  ROOT,
  save,
  submit,
} from "./runtime.mjs";
import {
  pda,
  pub,
  instruction,
  SYSTEM,
  LOADER,
} from "../../lib/solana/program.mjs";
import {
  decodeMultisig,
  assertSafeMultisig,
} from "../../lib/solana/squads.mjs";
const multisig = process.env.EVANGEL_GOVERNANCE_MULTISIG;
let governance = null;
await assertDevelopmentCluster();
const operator = await signer("operator");
const balance = (await rpc("getBalance", [operator.address])).value;
const binary = await readFile(
  "solana/program/target/deploy/evangel_factory.so",
);
const build = JSON.parse(
  await readFile("solana/program/target/deploy/build.json", "utf8"),
);
if (
  build.version !== 3 ||
  build.testFixtures ||
  build.venueCandidate !== false ||
  build.binarySha256 !== createHash("sha256").update(binary).digest("hex")
)
  throw Error("Deploy only the verified custody build, never test fixtures");
if (multisig) {
  const a = (
    await rpc("getAccountInfo", [
      multisig,
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  if (!a)
    throw Error("Multisig is not deployed on the selected development network");
  governance = assertSafeMultisig(
    await decodeMultisig(multisig, {
      owner: a.owner,
      data: new Uint8Array(Buffer.from(a.data[0], "base64")),
    }),
  );
}
const authority = governance?.vault || null;
const rent = await rpc("getMinimumBalanceForRentExemption", [
  binary.length * 2 + 45,
]);
const bufferRent = await rpc("getMinimumBalanceForRentExemption", [
  binary.length + 37,
]);
const fundingTarget = rent + bufferRent + 100_000_000;
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    authority,
    governanceMultisig: multisig || null,
    governanceReady: Boolean(governance),
    temporaryPayer: operator.address,
    programBytes: binary.length,
    estimatedProgramRentLamports: rent,
    conservativeFundingTargetLamports: fundingTarget,
    balanceLamports: balance,
  }),
);
if (!process.argv.includes("--broadcast")) {
  console.log(
    "Preflight only. Add --broadcast to deploy and transfer upgrade authority.",
  );
  process.exit(0);
}
if (!governance)
  throw Error(
    "Configure the verified independent 2-of-3 governance multisig before deployment",
  );
if (balance < fundingTarget)
  throw Error(
    "Fund the test-only payer with enough development-network SOL for program rent and transaction fees.",
  );
const deployment = JSON.parse(
  await readFile(`${ROOT}/deployment.json`, "utf8"),
);
if (
  deployment.version !== 3 ||
  deployment.dummy !== true ||
  deployment.genesis !== GENESIS ||
  !deployment["quote-mint"]
)
  throw Error(
    "Create and verify a fresh v3 dummy quote fixture before deployment",
  );
// Temporary CLI key file is mode 0600 and removed in finally. Secret is never logged or sent to inference.
const secret = spawnSync(
  "/usr/bin/security",
  [
    "find-generic-password",
    "-s",
    "evangel-solana-testnet-fixture-v1",
    "-a",
    "fixture",
    "-w",
  ],
  { encoding: "utf8" },
);
if (secret.status !== 0) throw Error("Keychain unavailable");
const bytes = createHmac("sha256", Buffer.from(secret.stdout.trim(), "hex"))
  .update("evangel:testnet:operator")
  .digest();
const keypair = await createKeyPairSignerFromPrivateKeyBytes(bytes);
await mkdir(ROOT, { recursive: true, mode: 0o700 });
const keyfile = `${ROOT}/temporary-deploy-key.json`;
await writeFile(
  keyfile,
  JSON.stringify([...bytes, ...getAddressEncoder().encode(keypair.address)]),
  { mode: 0o600 },
);
const cli =
  process.env.SOLANA_CLI || ".evangel/toolchain/solana-release/bin/solana";
function cliCall(args) {
  const result = spawnSync(
    cli,
    ["--url", RPC_URL, "--keypair", keyfile, "--output", "json", ...args],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0)
    throw Error(
      "Solana deployment command failed. No credentials or raw provider errors were logged.",
    );
  return JSON.parse(result.stdout);
}
try {
  const deployed = cliCall([
    "program",
    "deploy",
    "solana/program/target/deploy/evangel_factory.so",
    "--program-id",
    "solana/program/target/deploy/evangel_factory-keypair.json",
  ]);
  const program = deployed.programId || deployed.program_id;
  if (!program) throw Error("No program ID returned");
  await save("factory-deployment.json", {
    program,
    authority,
    governanceMultisig: multisig,
    binarySha256: build.binarySha256,
    governanceBaseline: governance,
    cluster: NETWORK.cluster,
    upgradeTransferPending: true,
  });
  const factory = await pda(program, "factory"),
    pd = await pda(LOADER, pub(program));
  await submit(
    [
      instruction(
        program,
        "initialize",
        {
          authority,
          quoteMint: deployment["quote-mint"],
          testMode: true,
          governanceMultisig: multisig,
        },
        [operator.address, factory, SYSTEM, pd, multisig],
        [operator],
      ),
    ],
    operator,
    { journal: "factory-initialize-v3.json" },
  );
  cliCall([
    "program",
    "set-upgrade-authority",
    program,
    "--new-upgrade-authority",
    authority,
    "--skip-new-upgrade-authority-signer-check",
  ]);
  const verified = cliCall(["program", "show", program]);
  if (verified.authority !== authority)
    throw Error("Upgrade authority transfer requires verification.");
  await save("factory-deployment.json", {
    program,
    factory,
    authority,
    governanceMultisig: multisig,
    binarySha256: build.binarySha256,
    governanceBaseline: governance,
    cluster: NETWORK.cluster,
    upgradeTransferPending: false,
  });
  console.log(JSON.stringify({ program, factory, authority }));
} finally {
  await rm(keyfile, { force: true });
}

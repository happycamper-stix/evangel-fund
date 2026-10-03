// Deploy a separate candidate on a development cluster; never touches factory authority.
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import {
  createKeyPairSignerFromPrivateKeyBytes,
  getAddressEncoder,
  getAddressDecoder,
} from "@solana/kit";
import {
  NETWORK,
  RPC_URL,
  ROOT,
  rpc,
  assertDevelopmentCluster,
  save,
} from "./runtime.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import { LOADER, pda, pub } from "../../lib/solana/program.mjs";
await assertDevelopmentCluster();
const manifest = JSON.parse(
  await readFile(".evangel/dao-programs/build.json", "utf8"),
);
if (manifest.developmentOnly !== false)
  throw Error("Production candidate required");
const binary = await readFile(".evangel/dao-programs/evangel_dao.so");
verifyProgramBytes(binary, manifest);
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
if (secret.status !== 0 || !/^[a-f0-9]{64}$/.test(secret.stdout.trim()))
  throw Error("Test Keychain signer unavailable");
await mkdir(ROOT, { recursive: true, mode: 0o700 });
const paths = [];
async function key(role) {
  const seed = createHmac("sha256", Buffer.from(secret.stdout.trim(), "hex"))
    .update(`evangel:testnet:${role}`)
    .digest();
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const path = `${ROOT}/temporary-${role}.json`;
  paths.push(path);
  await writeFile(
    path,
    JSON.stringify([...seed, ...getAddressEncoder().encode(signer.address)]),
    { mode: 0o600 },
  );
  return { address: signer.address, path };
}
try {
  const payer = await key("operator"),
    program = await key("dao-eacc-candidate"),
    buffer = await key("dao-eacc-buffer");
  const existing = (
    await rpc("getAccountInfo", [
      program.address,
      { encoding: "base64", commitment: "finalized" },
    ])
  ).value;
  if (existing)
    throw Error(
      "Candidate already exists; inspect it instead of redeploying implicitly",
    );
  const balance = (await rpc("getBalance", [payer.address])).value;
  const rent = await rpc("getMinimumBalanceForRentExemption", [
    binary.length * 2 + 45,
  ]);
  const bufferRent = await rpc("getMinimumBalanceForRentExemption", [
    binary.length + 37,
  ]);
  if (balance < rent + bufferRent + 100000000)
    throw Error("Insufficient development SOL");
  console.log(
    JSON.stringify({
      cluster: NETWORK.cluster,
      program: program.address,
      payer: payer.address,
      binarySha256: manifest.binarySha256,
      balanceLamports: balance,
    }),
  );
  if (!process.argv.includes("--broadcast")) process.exitCode = 0;
  else {
    const result = spawnSync(
      ".evangel/toolchain/solana-release/bin/solana",
      [
        "--url",
        RPC_URL,
        "--keypair",
        payer.path,
        "--output",
        "json",
        "program",
        "deploy",
        ".evangel/dao-programs/evangel_dao.so",
        "--program-id",
        program.path,
        "--buffer",
        buffer.path,
        "--use-rpc",
        "--max-sign-attempts",
        "3",
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 240000 },
    );
    // Never print CLI stderr: loader failures may contain recovery credentials.
    if (result.status !== 0)
      throw Error(
        "Candidate deployment incomplete; inspect deterministic program/buffer before retrying",
      );
    const pd = await pda(LOADER, pub(program.address));
    const observed = await rpc("getMultipleAccounts", [
      [program.address, pd],
      { encoding: "base64", commitment: "finalized" },
    ]);
    const [pa, da] = observed.value;
    if (pa?.owner !== LOADER || !pa.executable || da?.owner !== LOADER)
      throw Error("Deployment identity mismatch");
    const programBytes = Buffer.from(pa.data[0], "base64");
    if (
      programBytes.length !== 36 ||
      programBytes.readUInt32LE(0) !== 2 ||
      getAddressDecoder().decode(programBytes.subarray(4)) !== pd
    )
      throw Error("Wrong program-data pointer");
    const data = Buffer.from(da.data[0], "base64");
    if (
      data.readUInt32LE(0) !== 3 ||
      data[12] !== 1 ||
      getAddressDecoder().decode(data.subarray(13, 45)) !== payer.address
    )
      throw Error("Unexpected candidate authority");
    verifyProgramBytes(data.subarray(45), manifest);
    const record = {
      cluster: NETWORK.cluster,
      program: program.address,
      programData: pd,
      upgradeAuthority: payer.address,
      ...manifest,
      status:
        "deployed candidate; mutable; not initialized; no factory authority",
      observedSlot: observed.context.slot,
    };
    await save("dao-eacc-candidate.json", record);
    await writeFile(
      "docs/DAO_DEVNET_CANDIDATE.json",
      JSON.stringify(record, null, 2) + "\n",
    );
    console.log(JSON.stringify(record));
  }
} finally {
  for (const path of paths) await rm(path, { force: true });
}

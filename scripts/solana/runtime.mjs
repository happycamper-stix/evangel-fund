import { solanaNetwork, solanaRpcUrl } from "../../lib/solana/network.mjs";
export const NETWORK = solanaNetwork();
export const RPC_URL = solanaRpcUrl();
import { randomBytes, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import {
  createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
} from "@solana/kit";

export const GENESIS = NETWORK.genesis;
export const ROOT = NETWORK.root;
// Preserve the existing test-only Keychain identity so the funded payer remains accessible.
const SERVICE = "evangel-solana-testnet-fixture-v1";
export async function rpc(
  method,
  params = [],
  {
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  // Retry only rate-limited HTTP requests, preserving the exact signed wire payload.
  // Transaction generation and journals remain outside this loop.
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetcher(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429 && attempt < 4) {
      await response.body?.cancel();
      await sleep(Math.min(10000, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `Solana ${NETWORK.cluster} RPC HTTP ${response.status}; no endpoint or credential logged.`,
      );
    const data = await response.json();
    if (data.error)
      throw new Error(
        `Solana ${NETWORK.cluster} RPC ${method} failed (code ${Number(data.error.code)}).`,
      );
    return data.result;
  }
}
export async function assertDevelopmentCluster() {
  if ((await rpc("getGenesisHash")) !== GENESIS)
    throw new Error(
      "Wrong cluster: RPC does not match the selected development network.",
    );
}
export async function signer(role) {
  if (!/^[a-z-]{1,40}$/.test(role)) throw new Error("Invalid fixture role.");
  // A test-only seed is protected by the macOS login Keychain, never a source/env file.
  // Child-process output is captured; secret values are never printed.
  let result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", SERVICE, "-a", "fixture", "-w"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    if (result.status !== 44)
      throw new Error(
        "Unlock the macOS Keychain to access the test fixture signer.",
      );
    const seed = randomBytes(32).toString("hex");
    result = spawnSync(
      "/usr/bin/security",
      ["add-generic-password", "-s", SERVICE, "-a", "fixture", "-w", seed],
      { encoding: "utf8" },
    );
    if (result.status !== 0)
      throw new Error("Could not store the test-only seed in macOS Keychain.");
    result = { stdout: seed, status: 0 };
  }
  const seed = result.stdout.trim();
  if (!/^[0-9a-f]{64}$/.test(seed))
    throw new Error("Invalid test fixture Keychain entry.");
  const derived = createHmac("sha256", Buffer.from(seed, "hex"))
    .update(`evangel:testnet:${role}`)
    .digest();
  return createKeyPairSignerFromPrivateKeyBytes(derived);
}
export async function save(name, data) {
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(name))
    throw new Error("Invalid journal name");
  await mkdir(ROOT, { recursive: true, mode: 0o700 });
  const path = `${ROOT}/${name}`;
  await writeFile(`${path}.tmp`, JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(`${path}.tmp`, path);
}
export async function load(name) {
  return JSON.parse(await readFile(`${ROOT}/${name}`, "utf8"));
}
export async function finalized(signature, { allowFailure = false } = {}) {
  for (let i = 0; i < 90; i++) {
    const status = (
      await rpc("getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: true },
      ])
    ).value[0];
    if (status?.confirmationStatus === "finalized") {
      if (status.err && !allowFailure)
        throw new Error(`Testnet transaction failed: ${signature}`);
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Finalization pending: ${signature}. Resume verification; do not assume failure.`,
  );
}
export async function signedTransaction(instructions, payer) {
  await assertDevelopmentCluster();
  const lifetime = (
    await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])
  ).value;
  let message = createTransactionMessage({ version: 0 });
  message = setTransactionMessageFeePayerSigner(payer, message);
  message = setTransactionMessageLifetimeUsingBlockhash(
    {
      ...lifetime,
      lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight),
    },
    message,
  );
  message = appendTransactionMessageInstructions(instructions, message);
  const tx = await signTransactionMessageWithSigners(message);
  return {
    signature: getSignatureFromTransaction(tx),
    wire: getBase64EncodedWireTransaction(tx),
    lastValidBlockHeight: lifetime.lastValidBlockHeight,
  };
}
export async function submit(
  instructions,
  payer,
  { journal = "last-transaction.json", allowFailure = false } = {},
) {
  let previous;
  try {
    previous = await load(journal);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (previous) {
    await assertDevelopmentCluster();
    // Retry the identical signed transaction only; changing its blockhash could duplicate setup.
    const status = (
      await rpc("getSignatureStatuses", [
        [previous.signature],
        { searchTransactionHistory: true },
      ])
    ).value[0];
    if (!status)
      await rpc("sendTransaction", [
        previous.wire,
        { encoding: "base64", maxRetries: 3 },
      ]);
    await finalized(previous.signature, { allowFailure });
    return previous.signature;
  }
  const tx = await signedTransaction(instructions, payer);
  // Write the signed attempt before sending: network ambiguity can be reconciled by signature.
  await save(journal, tx);
  const returned = await rpc("sendTransaction", [
    tx.wire,
    {
      encoding: "base64",
      skipPreflight: allowFailure,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    },
  ]);
  if (returned !== tx.signature)
    throw new Error("RPC returned an unexpected transaction signature.");
  await finalized(tx.signature, { allowFailure });
  return tx.signature;
}
export async function account(address) {
  return (
    await rpc("getAccountInfo", [
      address,
      { encoding: "jsonParsed", commitment: "finalized" },
    ])
  ).value;
}

import { address, getAddressEncoder } from "@solana/kit";
const hex = (bytes) =>
  Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
const bytes = (value) =>
  Uint8Array.from(value.match(/../g), (x) => parseInt(x, 16));
export function reviewerContext(release) {
  if (
    release.reviewers?.length !== 3 ||
    new Set(release.reviewers).size !== 3 ||
    release.reviewers.includes(release.developer)
  )
    throw Error("Reviewer configuration incomplete");
  [release.developer, ...release.reviewers, release.devnetProgram].forEach(
    address,
  );
  if (!/^[a-f0-9]{64}$/.test(release.production?.binarySha256))
    throw Error("Missing reviewed artifact");
  return {
    version: 1,
    origin: "https://evangel.fund",
    cluster: "devnet",
    program: release.devnetProgram,
    binarySha256: release.production.binarySha256,
    developer: release.developer,
    reviewers: release.reviewers,
  };
}
export async function contextHash(context) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(context)),
      ),
    ),
  );
}
export async function createReviewerProof(context, wallet, now = Date.now()) {
  if (![context.developer, ...context.reviewers].includes(wallet))
    throw Error("This wallet is not a configured participant.");
  return {
    version: 1,
    wallet,
    contextHash: await contextHash(context),
    issuedAt: now,
    expiresAt: now + 7 * 86400000,
    nonce: hex(crypto.getRandomValues(new Uint8Array(32))),
  };
}
export function reviewerMessage(proof) {
  return [
    "Evangel wallet-control proof",
    "Origin: https://evangel.fund",
    "Purpose: Devnet governance rehearsal only",
    `Wallet: ${proof.wallet}`,
    `Configuration SHA-256: ${proof.contextHash}`,
    `Issued at (UTC milliseconds): ${proof.issuedAt}`,
    `Expires at (UTC milliseconds): ${proof.expiresAt}`,
    `Nonce: ${proof.nonce}`,
    "This confirms control of this wallet only.",
    "It does not approve code, activate governance, authorize transactions, or transfer assets.",
  ].join("\n");
}
export async function verifyReviewerProof(context, proof, now = Date.now()) {
  if (
    !proof ||
    proof.version !== 1 ||
    ![context.developer, ...context.reviewers].includes(proof.wallet) ||
    proof.contextHash !== (await contextHash(context))
  )
    throw Error("Proof does not match the configured participant and release.");
  if (
    !Number.isSafeInteger(proof.issuedAt) ||
    !Number.isSafeInteger(proof.expiresAt) ||
    proof.issuedAt > now + 60000 ||
    proof.issuedAt < 0 ||
    proof.expiresAt !== proof.issuedAt + 7 * 86400000 ||
    now >= proof.expiresAt ||
    !/^[a-f0-9]{64}$/.test(proof.nonce || "") ||
    !/^[a-f0-9]{128}$/.test(proof.signature || "")
  )
    throw Error("Proof is malformed or expired.");
  const key = await crypto.subtle.importKey(
    "raw",
    getAddressEncoder().encode(proof.wallet),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "Ed25519",
      key,
      bytes(proof.signature),
      new TextEncoder().encode(reviewerMessage(proof)),
    ))
  )
    throw Error("Wallet signature is invalid.");
  return {
    wallet: proof.wallet,
    role: proof.wallet === context.developer ? "developer" : "reviewer",
    contextHash: proof.contextHash,
    expiresAt: proof.expiresAt,
    status: "wallet control verified",
    grantsAuthority: false,
  };
}
export const signatureHex = hex;

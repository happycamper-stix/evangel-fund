import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSigner } from "@solana/kit";
import {
  reviewerContext,
  createReviewerProof,
  reviewerMessage,
  verifyReviewerProof,
  signatureHex,
} from "../lib/governance/reviewer-proof.mjs";
test("wallet proofs bind release, all participants and purpose without authorizing an action", async () => {
  const signers = await Promise.all(
    Array.from({ length: 5 }, () => generateKeyPairSigner()),
  );
  const release = {
    developer: signers[0].address,
    reviewers: signers.slice(1, 4).map((s) => s.address),
    devnetProgram: signers[4].address,
    production: { binarySha256: "ab".repeat(32) },
  };
  const context = reviewerContext(release),
    now = Date.now();
  const proof = await createReviewerProof(context, signers[1].address, now);
  proof.signature = signatureHex(
    new Uint8Array(
      await crypto.subtle.sign(
        "Ed25519",
        signers[1].keyPair.privateKey,
        new TextEncoder().encode(reviewerMessage(proof)),
      ),
    ),
  );
  assert.equal(
    (await verifyReviewerProof(context, proof, now)).grantsAuthority,
    false,
  );
  for (const changed of [
    { wallet: signers[2].address },
    { nonce: "aa".repeat(32) },
    { issuedAt: now - 1 },
    { expiresAt: now + 1000 },
    { signature: "00".repeat(64) },
    { signature: "bad" },
  ])
    await assert.rejects(
      verifyReviewerProof(context, { ...proof, ...changed }, now),
    );
  await assert.rejects(
    verifyReviewerProof(
      { ...context, binarySha256: "cd".repeat(32) },
      proof,
      now,
    ),
  );
  await assert.rejects(
    verifyReviewerProof(
      { ...context, reviewers: [...context.reviewers].reverse() },
      proof,
      now,
    ),
  );
  await assert.rejects(verifyReviewerProof(context, proof, proof.expiresAt));
  await assert.rejects(verifyReviewerProof(context, proof, now - 120000));
  await assert.rejects(createReviewerProof(context, signers[4].address));
  assert.throws(() =>
    reviewerContext({
      ...release,
      reviewers: [release.developer, ...release.reviewers.slice(1)],
    }),
  );
});

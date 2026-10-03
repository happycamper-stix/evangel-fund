import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertDaoPublicRelease } from "../../lib/solana/dao-release.mjs";
test("public release refuses development binary, missing identities, mutable guard and unclosed bootstrap", () => {
  const bytes = Buffer.from("reviewed production guard");
  const expected = {
    mint: "mint",
    developer: "developer",
    target: "target",
    treasury: "treasury",
    reviewers: ["a", "b", "c"],
  };
  const good = {
    bytes,
    manifest: {
      developmentOnly: false,
      binaryLength: bytes.length,
      binarySha256: createHash("sha256").update(bytes).digest("hex"),
    },
    state: {
      tag: 1,
      ...expected,
      developmentUntil: "0",
      supply: "21000000000000",
    },
    expected,
    immutable: true,
    targetAuthority: "guard",
    guardAuthority: "guard",
  };
  assert.equal(assertDaoPublicRelease(good), true);
  for (const altered of [
    { manifest: { ...good.manifest, developmentOnly: true } },
    { expected: { ...expected, mint: null } },
    { immutable: false },
    { state: { ...good.state, developmentUntil: "1" } },
    { targetAuthority: "old multisig" },
    { state: { ...good.state, reviewers: ["a", "a", "c"] } },
    { bytes: Buffer.from("different code") },
  ])
    assert.throws(() => assertDaoPublicRelease({ ...good, ...altered }));
});

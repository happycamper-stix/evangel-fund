import test from "node:test";
import assert from "node:assert/strict";
import { inspectDaoMint } from "../../lib/solana/dao-mint.mjs";
import { TOKEN } from "../../lib/solana/program.mjs";
test("mint compatibility matches guard boundaries and fails closed", () => {
  const data = Buffer.alloc(82);
  data.writeBigUInt64LE(21000000000000n, 36);
  data[44] = 6;
  data[45] = 1;
  const good = { owner: TOKEN, executable: false, data };
  assert.equal(inspectDaoMint(good).compatible, true);
  assert.equal(inspectDaoMint(null).compatible, false);
  for (const bad of [
    { owner: "wrong" },
    { executable: true },
    { data: data.subarray(0, 81) },
    { data: Buffer.concat([data, Buffer.alloc(84)]) },
  ])
    assert.equal(inspectDaoMint({ ...good, ...bad }).compatible, false);
  for (const offset of [0, 46, 44, 45]) {
    const changed = Buffer.from(data);
    changed[offset] = offset === 45 ? 0 : 1;
    assert.equal(inspectDaoMint({ ...good, data: changed }).compatible, false);
  }
  const zero = Buffer.from(data);
  zero.writeBigUInt64LE(0n, 36);
  assert.equal(inspectDaoMint({ ...good, data: zero }).compatible, false);
});

test("real e/acc snapshot allows only immutable self metadata with canonical TLV", async () => {
  const { default: fixture } = await import("./eacc-mint-fixture.json", {
    with: { type: "json" },
  });
  const data = Buffer.from(fixture.account.data[0], "base64");
  const inspect = (bytes) =>
    inspectDaoMint({ ...fixture.account, data: bytes }, fixture.mint);
  assert.equal(inspect(data).compatible, true);
  for (let n = 83; n < data.length; n++)
    assert.equal(inspect(data.subarray(0, n)).compatible, false);
  for (const at of [165, 166, 168, 170, 202, 234, 238, 270]) {
    const bad = Buffer.from(data);
    bad[at] ^= 1;
    assert.equal(inspect(bad).compatible, false);
  }
  assert.equal(
    inspect(Buffer.concat([data, Buffer.alloc(4)])).compatible,
    false,
  );
});

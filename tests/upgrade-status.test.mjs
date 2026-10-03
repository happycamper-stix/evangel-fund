import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  validateUpgradeAccounts,
  upgradeStatus,
} from "../lib/solana/upgrade-status.mjs";
import { LOADER, pub } from "../lib/solana/program.mjs";
const authority = "GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy",
  pd = "ABQ64bHGBXktfNAysjBmUNWDsLnCooDGriui76hFXXo3";
function fixture() {
  const old = Buffer.from([1, 2]),
    next = Buffer.from([3, 4, 5]);
  const describe = (b) => ({
    binaryLength: b.length,
    binarySha256: createHash("sha256").update(b).digest("hex"),
  });
  const data = Buffer.alloc(48);
  data.writeUInt32LE(3);
  data[12] = 1;
  data.set(pub(authority), 13);
  data.set(old, 45);
  const p = Buffer.alloc(36);
  p.writeUInt32LE(2);
  p.set(pub(pd), 4);
  const b = Buffer.alloc(40);
  b.writeUInt32LE(1);
  b[4] = 1;
  b.set(pub(authority), 5);
  b.set(next, 37);
  return {
    program: { owner: LOADER, executable: true, data: p },
    programData: { owner: LOADER, data },
    buffer: { owner: LOADER, data: b },
    baseline: { authority, ...describe(old) },
    candidate: describe(next),
    prepared: { programData: pd },
  };
}
test("upgrade status accepts exact staged bytes and recognizes a consumed deployed upgrade", () => {
  let f = fixture();
  assert.equal(validateUpgradeAccounts(f), "ready");
  f.programData.data.set([3, 4, 5], 45);
  f.buffer = null;
  assert.equal(validateUpgradeAccounts(f), "deployed");
});
test("upgrade status fails closed on code, buffer, owner, authority and account substitution", () => {
  for (const mutate of [
    (f) => (f.programData.data[47] = 9),
    (f) => (f.programData.data[13] ^= 1),
    (f) => (f.buffer.data[39] ^= 1),
    (f) => (f.buffer.data[5] ^= 1),
    (f) => (f.buffer = null),
    (f) => (f.program.owner = authority),
    (f) => (f.program.data[4] ^= 1),
    (f) => (f.programData.owner = authority),
    (f) => (f.programData.data = f.programData.data.subarray(0, 47)),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateUpgradeAccounts(f));
  }
});
test("upgrade endpoint refuses another network before calling RPC", async () => {
  let calls = 0;
  await assert.rejects(
    upgradeStatus({
      rpc: () => calls++,
      config: { configured: true, cluster: "mainnet-beta" },
      baseline: {},
      candidate: {},
      prepared: {},
    }),
  );
  assert.equal(calls, 0);
});

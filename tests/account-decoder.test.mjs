import test from "node:test";
import assert from "node:assert/strict";
import { Reader } from "../lib/solana/program.mjs";
test("RPC Buffer slices decode integers identically to browser byte arrays", () => {
  const backing = Buffer.alloc(64, 255);
  const bytes = backing.subarray(13, 33);
  bytes.writeBigUInt64LE(123456789n, 0);
  bytes.writeBigInt64LE(-123456789n, 8);
  bytes.writeUInt32LE(2, 16);
  for (const input of [bytes, Uint8Array.from(bytes)]) {
    const r = new Reader(input);
    assert.equal(r.u64(), "123456789");
    assert.equal(r.i64(), "-123456789");
    assert.equal(r.u32(), 2);
  }
});

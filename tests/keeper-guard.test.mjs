import test from "node:test";
import assert from "node:assert/strict";
import {
  assertKeeperBalance,
  MIN_KEEPER_LAMPORTS,
  MAX_KEEPER_LAMPORTS,
} from "../scripts/solana/keeper-guard.mjs";
test("keeper refuses depleted or overfunded signing wallets", () => {
  for (const n of [
    0,
    MIN_KEEPER_LAMPORTS - 1,
    MAX_KEEPER_LAMPORTS + 1,
    NaN,
    Infinity,
    1.5,
  ])
    assert.throws(() => assertKeeperBalance(n));
  for (const n of [MIN_KEEPER_LAMPORTS, 100_000_000, MAX_KEEPER_LAMPORTS])
    assert.doesNotThrow(() => assertKeeperBalance(n));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  FEE_POLICY,
  allocateVenueReceipts,
} from "../lib/solana/fee-policy.mjs";
test("5% gross fee includes protocol and the approved four project allocations", () => {
  assert.equal(
    Object.values(FEE_POLICY.tradeSharesBps).reduce((a, b) => a + b, 0),
    500,
  );
  assert.equal(FEE_POLICY.tradeSharesBps.protocol, 100);
  assert.equal(FEE_POLICY.protocolShareOfFeesBps, 2000);
  // 100 e/acc trade: five charged, one retained by venue, four received by Evangel.
  assert.deepEqual(allocateVenueReceipts(4_000_000n), {
    development: 2_550_000n,
    community: 500_000n,
    governance: 800_000n,
    foundation: 150_000n,
    dust: 0n,
  });
});
test("receipt allocation conserves base units including tiny amounts and u64 maximum", () => {
  for (const amount of [0n, 1n, 2n, 399n, 400n, 401n, 18446744073709551615n]) {
    const split = allocateVenueReceipts(amount);
    assert.equal(
      Object.values(split).reduce((a, b) => a + b, 0n),
      amount,
    );
    assert.ok(split.dust >= 0n && split.dust <= 3n);
  }
  for (const amount of [-1n, 1, 18446744073709551616n])
    assert.throws(() => allocateVenueReceipts(amount));
});

test("late collections book only to collection day and cannot backdate closed budgets", async () => {
  const { collectionDay, allocateCollection } =
    await import("../lib/solana/fee-policy.mjs");
  assert.equal(collectionDay(86399n), 0n);
  assert.equal(collectionDay(86400n), 1n);
  assert.throws(() =>
    allocateCollection({
      day: 0n,
      collectedAt: 86400n,
      previousReceipts: 0n,
      received: 400n,
    }),
  );
  const receipt = allocateCollection({
    day: 1n,
    collectedAt: 86400n,
    previousReceipts: 399n,
    received: 1n,
  });
  assert.equal(receipt.totalReceipts, 400n);
  assert.equal(
    Object.values(receipt.change).reduce((a, b) => a + b, 0n),
    1n,
  );
  assert.deepEqual(receipt.cumulative, allocateVenueReceipts(400n));
  assert.throws(() =>
    allocateCollection({
      day: 1n,
      collectedAt: 86400n,
      previousReceipts: 18446744073709551615n,
      received: 1n,
    }),
  );
  assert.throws(() =>
    allocateCollection({
      day: 1n,
      collectedAt: 86400n,
      previousReceipts: 1n,
      received: -1n,
    }),
  );
  for (const time of [-1n, 1, 9223372036854775808n])
    assert.throws(() => collectionDay(time));
});

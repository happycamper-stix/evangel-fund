import test from "node:test";
import assert from "node:assert/strict";
import {
  planOneSidedLaunch,
  initialAmounts,
  fixedFeeParameters,
  encodeOneSidedInitialization,
  encodePermanentLock,
  venueAddresses,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  INITIAL_BASE,
} from "../lib/solana/damm-plan.mjs";
const Q64 = 1n << 64n;
test("one-sided deposit is exactly 70%, quote liquidity is zero but transfer requires one base unit, and one unit less liquidity underfunds it", () => {
  for (const sqrtMin of [MIN_SQRT_PRICE, Q64 / 1000n, Q64, Q64 * 1000n]) {
    const plan = planOneSidedLaunch({ sqrtMin, sqrtMax: MAX_SQRT_PRICE });
    assert.equal(plan.baseDeposit, INITIAL_BASE);
    assert.equal(plan.quoteLiquidity, 0n);
    assert.equal(plan.quoteDeposit, 1n);
    assert.equal(plan.reserve, 6_300_000_000_000n);
    assert.equal(plan.sqrtPrice, sqrtMin);
    assert.equal(plan.adapterEnabled, false);
    assert.equal(
      initialAmounts({ ...plan, liquidity: plan.liquidity - 1n }).base,
      INITIAL_BASE - 1n,
    );
  }
});
test("unsafe ranges and values never produce a launch plan", () => {
  for (const range of [
    { sqrtMin: 0n, sqrtMax: Q64 },
    { sqrtMin: Q64, sqrtMax: Q64 },
    { sqrtMin: Q64, sqrtMax: MAX_SQRT_PRICE + 1n },
    { sqrtMin: Number(Q64), sqrtMax: MAX_SQRT_PRICE },
    { sqrtMin: MAX_SQRT_PRICE - 1n, sqrtMax: MAX_SQRT_PRICE },
  ])
    assert.throws(() => planOneSidedLaunch(range));
});
test("fixed fee encoding has no dynamic fees, compounding or decreasing fee schedule", async () => {
  const fee = fixedFeeParameters();
  assert.equal(fee.length, 31);
  assert.equal(new DataView(fee.buffer).getBigUint64(0, true), 50_000_000n);
  assert.ok(fee.slice(8).every((b) => b === 0));
  const data = await encodeOneSidedInitialization({
    sqrtMin: Q64,
    sqrtMax: Q64 * 2n,
  });
  assert.equal(data.length, 107);
  assert.deepEqual([...data.slice(-3)], [1, 1, 0]);
  assert.equal((await encodePermanentLock(1n)).length, 24);
  await assert.rejects(encodePermanentLock(0n));
  await assert.rejects(encodePermanentLock(1n << 128n));
});
test("canonical pool sorts raw mint bytes while token vault identities retain A/B ordering", async () => {
  const a = "92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc",
    b = "CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU",
    n = "FqXojD69EQyiT1Vckz3twzMTUXNr4yL3Qe5kcroAV2GM";
  const forward = await venueAddresses(a, b, n),
    reverse = await venueAddresses(b, a, n);
  assert.equal(forward.pool, reverse.pool);
  assert.equal(forward.baseVault, reverse.quoteVault);
  assert.notEqual(forward.baseVault, forward.quoteVault);
  await assert.rejects(venueAddresses(a, a, n));
});

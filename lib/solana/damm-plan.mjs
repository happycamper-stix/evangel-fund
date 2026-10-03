// Pinned-source construction helpers only. Never broadcast these as an Evangel
// launch: custody's atomic CPI, binary provenance and postconditions are required.
import { concat, integer, sha256, pda, pub } from "./program.mjs";
import { DAMM_V2 } from "./venue-policy.mjs";
export const MIN_SQRT_PRICE = 4295048016n;
export const MAX_SQRT_PRICE = 79226673521066979257578248091n;
export const LAUNCH_SUPPLY = 21_000_000_000_000n;
export const INITIAL_BASE = 14_700_000_000_000n;
const U128_MAX = (1n << 128n) - 1n;
const U256_MAX = (1n << 256n) - 1n;
function uint(value, max, name) {
  if (typeof value !== "bigint" || value < 0n || value > max)
    throw Error(`Invalid ${name}`);
  return value;
}
function u128(value) {
  uint(value, U128_MAX, "u128");
  return concat([integer(value & ((1n << 64n) - 1n)), integer(value >> 64n)]);
}
export function initialAmounts({ sqrtMin, sqrtMax, liquidity }) {
  uint(sqrtMin, MAX_SQRT_PRICE, "minimum price");
  uint(sqrtMax, MAX_SQRT_PRICE, "maximum price");
  uint(liquidity, U128_MAX, "liquidity");
  if (sqrtMin < MIN_SQRT_PRICE || sqrtMax <= sqrtMin || liquidity === 0n)
    throw Error("Invalid one-sided range");
  const denominator = sqrtMin * sqrtMax;
  const numerator = liquidity * (sqrtMax - sqrtMin);
  if (numerator > U256_MAX || denominator > U256_MAX)
    throw Error("Venue arithmetic overflow");
  const base = (numerator + denominator - 1n) / denominator;
  if (base > (1n << 64n) - 1n) throw Error("Deposit exceeds u64");
  return { base, quote: 0n };
}
export function planOneSidedLaunch({ sqrtMin, sqrtMax }) {
  initialAmounts({ sqrtMin, sqrtMax, liquidity: 1n });
  // Smallest L such that ceil(L * delta / denominator) is INITIAL_BASE.
  // Do not silently deposit less than 70%, borrow from reserve or use float math.
  const liquidity =
    ((INITIAL_BASE - 1n) * sqrtMin * sqrtMax) / (sqrtMax - sqrtMin) + 1n;
  const amounts = initialAmounts({ sqrtMin, sqrtMax, liquidity });
  if (amounts.base !== INITIAL_BASE || amounts.quote !== 0n)
    throw Error("Exact 70% deposit is not representable");
  return Object.freeze({
    sqrtMin,
    sqrtMax,
    sqrtPrice: sqrtMin,
    liquidity,
    baseDeposit: amounts.base,
    quoteLiquidity: amounts.quote,
    // Venue requires one base unit of each mint to prove ownership.
    quoteDeposit: 1n,
    supply: LAUNCH_SUPPLY,
    reserve: LAUNCH_SUPPLY - INITIAL_BASE,
    grossFeeBps: 500,
    collectFeeMode: 1,
    dynamicFees: false,
    adapterEnabled: false,
  });
}
export function fixedFeeParameters() {
  // PoolFeeParameters: 27-byte BorshFeeTimeScheduler, u16 compounding,
  // u8 padding, Option<DynamicFeeParameters>::None. Linear mode, zero periods.
  return concat([
    integer(50_000_000n),
    new Uint8Array(2),
    integer(0n),
    integer(0n),
    Uint8Array.of(0),
    new Uint8Array(2),
    Uint8Array.of(0, 0),
  ]);
}
export async function encodeOneSidedInitialization(range) {
  const plan = planOneSidedLaunch(range);
  const discriminator = (
    await sha256("global:initialize_customizable_pool")
  ).slice(0, 8);
  return concat([
    discriminator,
    fixedFeeParameters(),
    u128(plan.sqrtMin),
    u128(plan.sqrtMax),
    Uint8Array.of(0),
    u128(plan.liquidity),
    u128(plan.sqrtPrice),
    // timestamp activation, OnlyB fees, activation_point=None (immediate)
    Uint8Array.of(1, 1, 0),
  ]);
}
export async function encodePermanentLock(liquidity) {
  if (liquidity === 0n) throw Error("Cannot lock zero liquidity");
  return concat([
    (await sha256("global:permanent_lock_position")).slice(0, 8),
    u128(liquidity),
  ]);
}
export async function venueAddresses(baseMint, quoteMint, positionMint) {
  if (baseMint === quoteMint) throw Error("Pool mints must differ");
  const a = pub(baseMint),
    b = pub(quoteMint);
  let comparison = 0;
  for (let i = 0; i < 32 && comparison === 0; i++) comparison = a[i] - b[i];
  const pool = await pda(
    DAMM_V2.program,
    "cpool",
    comparison > 0 ? a : b,
    comparison > 0 ? b : a,
  );
  return {
    pool,
    poolAuthority: await pda(DAMM_V2.program, "pool_authority"),
    position: await pda(DAMM_V2.program, "position", pub(positionMint)),
    positionNftAccount: await pda(
      DAMM_V2.program,
      "position_nft_account",
      pub(positionMint),
    ),
    baseVault: await pda(DAMM_V2.program, "token_vault", a, pub(pool)),
    quoteVault: await pda(DAMM_V2.program, "token_vault", b, pub(pool)),
    eventAuthority: await pda(DAMM_V2.program, "__event_authority"),
  };
}

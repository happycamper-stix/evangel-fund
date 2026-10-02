// Target venue economics. This does not enable an adapter or alter the legacy local curve.
export const FEE_POLICY = Object.freeze({
  grossTradeFeeBps: 500,
  protocolShareOfFeesBps: 2000,
  tradeSharesBps: Object.freeze({
    protocol: 100,
    development: 255,
    community: 50,
    governance: 80,
    foundation: 15,
  }),
});
// Apply to actual net venue receipts, after protocol fees have already been deducted.
// Cumulative accounting avoids rewarding transaction splitting. Dust stays in custody
// until the day's close, when it follows the existing development-surplus rule.
export function allocateVenueReceipts(receipts) {
  if (
    typeof receipts !== "bigint" ||
    receipts < 0n ||
    receipts > 18446744073709551615n
  )
    throw Error("Receipts must be an unsigned u64 bigint.");
  const allocation = Object.fromEntries(
    Object.entries(FEE_POLICY.tradeSharesBps)
      .filter(([key]) => key !== "protocol")
      .map(([key, bps]) => [key, (receipts * BigInt(bps)) / 400n]),
  );
  return {
    ...allocation,
    dust:
      receipts -
      Object.values(allocation).reduce((sum, value) => sum + value, 0n),
  };
}

// Accounting model for a future authenticated CPI receipt. The onchain adapter
// must supply Clock time and verified balance deltas; browser inputs are not proof.
export function collectionDay(unixSeconds) {
  if (
    typeof unixSeconds !== "bigint" ||
    unixSeconds < 0n ||
    unixSeconds > 9223372036854775807n
  )
    throw Error("Collection time must be a nonnegative i64 bigint.");
  return unixSeconds / 86400n;
}
export function allocateCollection({
  day,
  collectedAt,
  previousReceipts,
  received,
}) {
  if (typeof day !== "bigint" || day !== collectionDay(collectedAt))
    throw Error("Receipts can only be booked to their collection day.");
  const previous = allocateVenueReceipts(previousReceipts);
  allocateVenueReceipts(received); // Validate before addition, including negative input.
  const totalReceipts = previousReceipts + received;
  const cumulative = allocateVenueReceipts(totalReceipts);
  return {
    day,
    totalReceipts,
    cumulative,
    change: Object.fromEntries(
      Object.keys(cumulative).map((key) => [
        key,
        cumulative[key] - previous[key],
      ]),
    ),
  };
}

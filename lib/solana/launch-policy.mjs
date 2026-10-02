import { FEE_POLICY } from "./fee-policy.mjs";
// Pinned compatibility assessment, not an enabled adapter or a claim of deployed integration.
export const METEORA_DBC = Object.freeze({
  revision: "f552f20aa3c1c7631427c3827aeea7c58b902813",
  source:
    "https://github.com/MeteoraAg/dynamic-bonding-curve/tree/f552f20aa3c1c7631427c3827aeea7c58b902813",
  protocolFeeShareBps: 2000,
  reserveAccessibleBeforeGraduation: false,
});
export function launchCompatibility() {
  const grossFeeBps = 500;
  return {
    enabled: false,
    venue: "Meteora DBC",
    revision: METEORA_DBC.revision,
    requestedGrossFeeBps: grossFeeBps,
    evangelReceiptsAtRequestedFeeBps:
      (grossFeeBps * (10000 - METEORA_DBC.protocolFeeShareBps)) / 10000,
    approvedTradeSharesBps: FEE_POLICY.tradeSharesBps,
    feeSpecificationCompatible: true,
    blockers: [
      "The live e/acc metadata-only mint passes the pinned DAMM v2 source policy; deployed venue binary and CPI integration remain unverified.",
      "Governed reserve is not accessible for the immediate adoption reward before graduation.",
      "The new net-receipt allocation is specified and tested; the legacy local curve still uses the previous allocation and is not a venue adapter.",
      "No production trading adapter has passed exact supply, reserve custody, fee and upgrade-authority verification.",
    ],
  };
}

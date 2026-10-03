import { DAMM_V2 } from "./venue-policy.mjs";
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
  return {
    enabled: false,
    venue: "Meteora DAMM v2",
    revision: DAMM_V2.revision,
    source: `https://github.com/MeteoraAg/damm-v2/tree/${DAMM_V2.revision}`,
    requestedGrossFeeBps: 500,
    evangelReceiptsAtRequestedFeeBps: 400,
    approvedTradeSharesBps: FEE_POLICY.tradeSharesBps,
    feeSpecificationCompatible: true,
    implementation: "Local Rust adapter; separate review build; not deployed",
    quoteInitializationBaseUnits: "1",
    blockers: [
      "Recheck the verified mainnet venue binary before activation; upstream upgrades invalidate prior provenance.",
      "The adapter requires a reviewed governance upgrade and public Devnet acceptance receipts.",
      "Production launch/swap UI, sponsored dust service and automated collection require deployment-bound acceptance before enabling.",
      "Real owner adoption, independent reviewer signatures and the full participant pilot remain required.",
      "Mainnet configuration and release remain disabled.",
    ],
  };
}

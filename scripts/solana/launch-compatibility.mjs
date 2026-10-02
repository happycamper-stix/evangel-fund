import {
  launchCompatibility,
  METEORA_DBC,
} from "../../lib/solana/launch-policy.mjs";
console.log(
  JSON.stringify(
    { ...launchCompatibility(), source: METEORA_DBC.source },
    null,
    2,
  ),
);

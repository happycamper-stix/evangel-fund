import { solanaNetwork } from "./network.mjs";
import { address } from "@solana/kit";
export const FOUNDATION = "92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc";
export function solanaConfig(env = process.env) {
  const network = solanaNetwork(
    env.NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER || "devnet",
  );
  const program = env.EVANGEL_SOLANA_PROGRAM || "";
  const governanceMultisig = env.EVANGEL_GOVERNANCE_MULTISIG || "";
  if (program) address(program);
  if (governanceMultisig) address(governanceMultisig);
  return {
    configured: Boolean(program),
    program: program || null,
    governanceMultisig: governanceMultisig || null,
    cluster: network.cluster,
    chain: network.chain,
    explorer: "https://explorer.solana.com",
    launchEnabled: false,
    quoteAsset: "e/acc",
    feeBps: 500,
    launchStatus: "Trading integration under verification",
    quoteStatus:
      "Development networks use a dummy e/acc quote mint; production venue verification pending",
  };
}

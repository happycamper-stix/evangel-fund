import baseline from "@/docs/DEVNET_ADDRESSES.json";
import candidate from "@/docs/VENUE_ADAPTER_CANDIDATE.json";
import prepared from "@/docs/DEVNET_UPGRADE_PREPARATION.json";
import { upgradeStatus } from "@/lib/solana/upgrade-status.mjs";
import { rpc } from "@/lib/solana/state.mjs";
import { solanaConfig } from "@/lib/solana/config.mjs";
import { apiError } from "@/lib/server/http.mjs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      await upgradeStatus({
        rpc,
        config: solanaConfig(),
        baseline,
        candidate,
        prepared,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(
      error,
      "Upgrade verification unavailable or deployment changed. No signing action is enabled.",
    );
  }
}

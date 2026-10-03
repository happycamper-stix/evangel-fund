import release from "@/docs/DAO_DEVNET_REHEARSAL.json";
import { rpc } from "@/lib/solana/state.mjs";
import { rehearsalState } from "@/lib/solana/rehearsal-state.mjs";
import { apiError, RequestError } from "@/lib/server/http.mjs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const owner = new URL(request.url).searchParams.get("owner") || undefined;
    if (
      owner &&
      ![release.expected.developer, ...release.expected.reviewers].includes(
        owner,
      )
    )
      throw new RequestError("Select a configured participant wallet.");
    return Response.json(await rehearsalState({ rpc, release, owner }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(
      error,
      "The rehearsal could not be verified on Devnet. Signing is disabled; try refreshing shortly.",
    );
  }
}

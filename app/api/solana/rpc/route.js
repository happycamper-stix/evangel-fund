import { readJson, RequestError, apiError } from "@/lib/server/http.mjs";
import { rpc, assertCluster } from "@/lib/solana/state.mjs";
import { solanaConfig } from "@/lib/solana/config.mjs";
import { address } from "@solana/kit";
// Read-only RPC relay: browser never receives a private provider URL or a signing key.
export async function POST(request) {
  try {
    const body = await readJson(request, 3000);
    if (!solanaConfig().configured)
      throw new RequestError("Solana factory deployment is pending.", 503);
    await assertCluster();
    let params;
    switch (body.method) {
      case "getLatestBlockhash":
        params = [{ commitment: "confirmed" }];
        break;
      case "getSignatureStatuses":
        if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(body.signature || ""))
          throw new RequestError("Invalid signature");
        params = [[body.signature], { searchTransactionHistory: true }];
        break;
      case "getAccountInfo":
        address(body.address);
        params = [
          body.address,
          { encoding: "base64", commitment: "confirmed" },
        ];
        break;
      default:
        throw new RequestError("Unsupported RPC method");
    }
    return Response.json(
      { result: await rpc(body.method, params) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, "Could not read Solana state.");
  }
}

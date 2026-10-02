import { state } from "@/lib/solana/state.mjs";
import { apiError } from "@/lib/server/http.mjs";
export async function GET() {
  try {
    return Response.json(await state(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(
      error,
      "Solana state is unavailable. No balances or transactions were assumed.",
    );
  }
}

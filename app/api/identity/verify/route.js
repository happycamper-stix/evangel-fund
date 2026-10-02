import { auth, clerkClient } from "@clerk/nextjs/server";
import { verifyRepository } from "@/lib/identity/github.mjs";
import { readJson, apiError, RequestError } from "@/lib/server/http.mjs";
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId)
      throw new RequestError("Sign in before verifying your repository.", 401);
    const { repository, wallet, pullRequest } = await readJson(request, 2048);
    const proof = await verifyRepository({
      client: await clerkClient(),
      userId,
      repository,
      wallet,
      pullRequest,
    });
    return Response.json(proof, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(
      error,
      "Identity verification is unavailable. Please retry.",
    );
  }
}

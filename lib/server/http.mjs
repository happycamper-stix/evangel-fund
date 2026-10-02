import { checkRateLimit } from "@vercel/firewall";
export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
// Only explicitly classified input errors are returned. RPC/provider errors may
// include credentials, request headers, or full signed payloads.
export function apiError(
  error,
  fallback = "Request could not be completed. Please retry.",
) {
  return Response.json(
    { error: error instanceof RequestError ? error.message : fallback },
    {
      status: error instanceof RequestError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function readJson(request, limit = 20000) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new RequestError("Cross-origin request rejected.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new RequestError("Cross-site request rejected.", 403);
  if (Number(request.headers.get("content-length")) > limit)
    throw new RequestError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("JSON body required.");
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestError("Request too large.", 413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new RequestError("A JSON object is required.");
    return body;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Invalid JSON body.");
  }
}
const windows = new Map();
export async function providerBudget(
  request,
  scope,
  { env = process.env, check = checkRateLimit, now = Date.now() } = {},
) {
  // Hosted paid calls fail closed without a real shared WAF rule. A local map
  // alone cannot enforce budgets across workers, instances, or deployments.
  if (env.NODE_ENV === "production" || env.VERCEL) {
    const rule = env.EVANGEL_PROVIDER_RATE_LIMIT_ID;
    if (!env.VERCEL || !rule)
      throw new RequestError(
        "Provider access is waiting for shared usage limits to be configured.",
        503,
      );
    let result;
    try {
      result = await check(rule, {
        request,
        rateLimitKey: `evangel-provider:${scope}`,
      });
    } catch {
      throw new RequestError(
        "Provider usage limits are temporarily unavailable.",
        503,
      );
    }
    if (result.error)
      throw new RequestError("Provider usage limits are unavailable.", 503);
    if (result.rateLimited)
      throw new RequestError(
        "Provider usage limit reached. Please try again later.",
        429,
      );
    return;
  }
  // Global per-provider ceiling for local development; no attacker-supplied IP key.
  const current = windows.get(scope);
  if (!current || current.until <= now) {
    windows.set(scope, { until: now + 60000, count: 1 });
    return;
  }
  if (current.count >= 10)
    throw new RequestError(
      "Please wait before requesting this provider again.",
      429,
    );
  current.count++;
}

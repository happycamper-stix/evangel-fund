import test from "node:test";
import assert from "node:assert/strict";
import {
  readJson,
  apiError,
  RequestError,
  providerBudget,
} from "../lib/server/http.mjs";
const request = (body, headers = {}) =>
  new Request("https://evangel.example/api/test", {
    method: "POST",
    body,
    headers,
  });
test("request limits count streamed UTF-8 bytes, reject foreign origins and invalid JSON", async () => {
  await assert.rejects(
    readJson(request('"' + "é".repeat(10) + '"'), 15),
    (e) => e.status === 413,
  );
  await assert.rejects(
    readJson(request("{}", { origin: "https://attacker.example" })),
    (e) => e.status === 403,
  );
  await assert.rejects(
    readJson(request("{}", { "sec-fetch-site": "cross-site" })),
    (e) => e.status === 403,
  );
  await assert.rejects(readJson(request("{invalid}")), /Invalid JSON/);
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
});
test("unclassified provider errors cannot leak secret-bearing details", async () => {
  const response = apiError(
    new Error("https://rpc.example/secret?api_key=private-key"),
  );
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-key|rpc.example/);
  assert.equal(
    (await apiError(new RequestError("Invalid page.", 400)).json()).error,
    "Invalid page.",
  );
});
test("hosted paid providers fail closed without real shared rate limits", async () => {
  await assert.rejects(
    providerBudget(request("{}"), "x", { env: { NODE_ENV: "production" } }),
    (e) => e.status === 503,
  );
  const env = { VERCEL: "1", EVANGEL_PROVIDER_RATE_LIMIT_ID: "real-rule" };
  await assert.rejects(
    providerBudget(request("{}"), "x", {
      env,
      check: async () => ({ rateLimited: false, error: "not-found" }),
    }),
    (e) => e.status === 503,
  );
  await assert.rejects(
    providerBudget(request("{}"), "x", {
      env,
      check: async () => {
        throw new Error("secret");
      },
    }),
    (e) => e.status === 503,
  );
  await assert.rejects(
    providerBudget(request("{}"), "x", {
      env,
      check: async () => ({ rateLimited: true }),
    }),
    (e) => e.status === 429,
  );
  await providerBudget(request("{}"), "x", {
    env,
    check: async () => ({ rateLimited: false }),
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEvidence,
  inferenceStatus,
} from "../lib/governance/inference.mjs";
const report = {
  verdict: "abstain",
  confidence: 0,
  conflict: false,
  reasoning: "Missing evidence",
  limitations: "No proof",
  citations: [],
};
const catalog = async () => Response.json({ data: [{ id: "fixture/model" }] });
test("inference status exposes no credentials and requires both model and auth", () => {
  assert.equal(
    inferenceStatus({ EVANGEL_AGENT_MODEL: "fixture/model" }).configured,
    false,
  );
  const s = inferenceStatus({
    EVANGEL_AGENT_MODEL: "fixture/model",
    VERCEL_OIDC_TOKEN: "private-credential",
  });
  assert.equal(s.configured, true);
  assert.equal(s.advisoryOnly, true);
  assert.ok(!JSON.stringify(s).includes("private-credential"));
});
test("Gateway evaluation is bounded, tool-free, and treats evidence as user data", async () => {
  const output = await evaluateEvidence({
    model: "fixture/model",
    instructions: "rubric",
    context: "untrusted",
    fetchImpl: catalog,
    generate: async (options) => {
      assert.equal(options.model, "fixture/model");
      assert.equal(options.system, "rubric");
      assert.match(options.prompt, /untrusted/);
      assert.equal(options.maxRetries, 0);
      assert.equal(options.maxOutputTokens, 4096);
      assert.equal(options.tools, undefined);
      assert.ok(options.abortSignal);
      return { output: report, finishReason: "stop" };
    },
  });
  assert.deepEqual(output, report);
});
test("missing models never make an inference call", async () => {
  let called = false;
  await assert.rejects(
    evaluateEvidence({
      model: "missing",
      fetchImpl: catalog,
      generate: async () => {
        called = true;
      },
    }),
    /no report was accepted/,
  );
  assert.equal(called, false);
});
test("provider failures and incomplete outputs fail closed without leaking details", async () => {
  for (const generate of [
    async () => {
      throw new Error("private-credential");
    },
    async () => ({ output: report, finishReason: "length" }),
    async () => ({ finishReason: "stop" }),
  ]) {
    await assert.rejects(
      evaluateEvidence({
        model: "fixture/model",
        fetchImpl: catalog,
        generate,
      }),
      (e) =>
        !e.message.includes("private-credential") &&
        e.message.includes("no report was accepted"),
    );
  }
});

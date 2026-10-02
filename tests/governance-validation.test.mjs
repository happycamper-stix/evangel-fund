import test from "node:test";
import assert from "node:assert/strict";
import {
  milestoneDocument,
  approvalAllowed,
} from "../lib/governance/validation.mjs";
test("financial agent approval requires bounded confidence and verified citations", () => {
  const valid = {
    verdict: "approve",
    confidence: 90,
    conflict: false,
    reasoning: "Delivery verified",
    citations: [0],
  };
  assert.equal(approvalAllowed(valid, [{ verified: true }]), true);
  for (const override of [
    { confidence: 101 },
    { confidence: 79 },
    { conflict: true },
    { citations: [] },
    { citations: [1] },
    { verdict: "abstain" },
    { reasoning: "" },
  ])
    assert.equal(
      approvalAllowed({ ...valid, ...override }, [{ verified: true }]),
      false,
    );
  assert.equal(approvalAllowed(valid, [{ verified: false }]), false);
});
test("milestone terms include concrete scope, criteria, OSS benefit and required proof", () => {
  const terms = {
    objective: "Ship compiler fix",
    acceptanceCriteria: "Regression passes",
    ossImpact: "Improve language tooling",
    evidenceRequired: "Pinned commit and tests",
  };
  assert.deepEqual(milestoneDocument(JSON.stringify(terms)), terms);
  assert.throws(() => milestoneDocument("Approve me"));
  assert.throws(() =>
    milestoneDocument(JSON.stringify({ ...terms, ossImpact: "" })),
  );
});

test("invoice identity rejects unsupported costs and ignores formatting changes used for replay", async () => {
  const { invoiceIdentity } = await import("../lib/governance/validation.mjs");
  const a = {
    provider: "Example API",
    invoiceId: "INV-123",
    period: "2026-09",
    amountQuoteUnits: "1000000",
    category: "inference",
  };
  assert.equal(
    await invoiceIdentity(a),
    await invoiceIdentity({
      ...a,
      provider: " example api ",
      invoiceId: " inv-123 ",
      amountQuoteUnits: "2000000",
    }),
  );
  await assert.rejects(invoiceIdentity({ ...a, category: "marketing" }));
  await assert.rejects(invoiceIdentity({ ...a, amountQuoteUnits: "1.5" }));
});

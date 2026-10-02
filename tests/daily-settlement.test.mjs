import test from "node:test";
import assert from "node:assert/strict";
import { dailySettlementPlan } from "../lib/solana/settlement.mjs";
test("keeper plans overdue project-specific payouts without consuming unpaid expenses or community balances", () => {
  const project = { address: "project", owner: "owner", adopted: true };
  const feeDay = {
    address: "day",
    project: "project",
    day: "1",
    fees: "51",
    development: "30",
    community: "5",
    governance: "8",
    expenseCommitted: "5",
    foundation: "1",
    settled: false,
  };
  const snapshot = { projects: [project], feeDays: [feeDay] };
  assert.equal(dailySettlementPlan(snapshot, 86400).length, 0);
  const [plan] = dailySettlementPlan(snapshot, 4 * 86400);
  assert.equal(plan.developmentClaim, "40");
  assert.equal(plan.reservedExpenses, "5");
  assert.equal(plan.developmentRecipient, "owner");
  feeDay.settled = true;
  feeDay.development = "0";
  assert.equal(dailySettlementPlan(snapshot, 4 * 86400).length, 0);
  feeDay.development = "5";
  assert.equal(
    dailySettlementPlan(snapshot, 4 * 86400)[0].developmentClaim,
    "5",
  );
  project.adopted = false;
  feeDay.settled = false;
  assert.equal(
    dailySettlementPlan(snapshot, 4 * 86400)[0].developmentRecipient,
    null,
  );
  assert.throws(() => dailySettlementPlan(snapshot, null));
});

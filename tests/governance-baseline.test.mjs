import test from "node:test";
import assert from "node:assert/strict";
import { governanceDrift } from "../lib/solana/governance-baseline.mjs";
test("monitor alerts on a valid-shaped reviewer replacement, changed delay and missing baseline", () => {
  const current = {
    address: "squad",
    vault: "vault",
    threshold: 2,
    timeLock: 172800,
    configAuthority: "none",
    members: [
      { address: "one", permissions: 7 },
      { address: "two", permissions: 7 },
      { address: "foundation", permissions: 7 },
    ],
  };
  const baseline = {
    program: "program",
    upgradeTransferPending: false,
    governanceBaseline: structuredClone(current),
  };
  assert.deepEqual(governanceDrift(current, baseline, "program"), []);
  assert.equal(
    governanceDrift(
      {
        ...current,
        members: [
          ...current.members.slice(1),
          { address: "replacement", permissions: 7 },
        ],
      },
      baseline,
      "program",
    ).length,
    1,
  );
  assert.deepEqual(
    governanceDrift({ ...current, timeLock: 259200 }, baseline, "program"),
    ["Governance timeLock changed"],
  );
  assert.equal(governanceDrift(current, null, "program").length, 1);
  assert.equal(governanceDrift(current, baseline, "other-program").length, 1);
  assert.deepEqual(
    governanceDrift(
      { ...current, members: [...current.members].reverse() },
      baseline,
      "program",
    ),
    [],
  );
});

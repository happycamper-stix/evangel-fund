import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewedInstruction,
  reviewerMember,
} from "../lib/governance/reviewer.mjs";
import { solanaNetwork } from "../lib/solana/network.mjs";
const program = "Ac4F5CNu8tYdUx4RZTKRchFyj5nZ9wG12eh3zDVJn7LV";
const vault = "GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy";
const multisig = "4jiu9tuEWQueXfhPd6HwvVVzpZr2pvVrtrcEyMCb1VMh";
const factory = "ApQ5H1KCi5wEaoy9jHhwRAcbjGqXKkpW9nDikFrvNZ8w";
const now = 1800000000000;
const snapshot = {
  config: { configured: true, cluster: "devnet", program },
  factory: { address: factory, authority: vault },
  governance: {
    address: multisig,
    vault,
    timeLock: 172800,
    members: [{ address: program, permissions: 7 }],
  },
};
const action = () => ({
  version: 3,
  cluster: "devnet",
  genesis: solanaNetwork("devnet").genesis,
  program,
  multisig,
  authority: vault,
  action: "rejectAdoption",
  args: { report: "a".repeat(64) },
  reportHash: "a".repeat(64),
  accounts: [program, multisig],
  expiresAt: now + 300000,
  executionExpiresAt: now / 1000 + 7 * 86400,
});
test("reviewed action binds the instruction to deployment and execution expiry", () => {
  const a = action();
  const ix = reviewedInstruction(a, snapshot, { now, creating: true });
  assert.equal(ix.programAddress, program);
  for (const patch of [
    { version: 2 },
    { cluster: "testnet" },
    { genesis: "wrong" },
    { program: vault },
    { multisig: program },
    { authority: program },
    { action: "initialize" },
    { reportHash: "b".repeat(64) },
    { accounts: [] },
    { accounts: [program] },
    { accounts: ["invalid"] },
    { executionExpiresAt: now / 1000 },
    { executionExpiresAt: now / 1000 + 8 * 86400 },
  ])
    assert.throws(() =>
      reviewedInstruction({ ...a, ...patch }, snapshot, { now }),
    );
});
test("creation requires fresh verification and a window exceeding the timelock", () => {
  for (const patch of [
    { expiresAt: now - 1 },
    { expiresAt: now + 300001 },
    { executionExpiresAt: now / 1000 + 172800 },
  ])
    assert.throws(() =>
      reviewedInstruction({ ...action(), ...patch }, snapshot, {
        now,
        creating: true,
      }),
    );
  assert.doesNotThrow(() =>
    reviewedInstruction({ ...action(), expiresAt: now - 1 }, snapshot, { now }),
  );
});
test("unsafe numeric arguments and unconfigured signers fail closed", () => {
  const a = action();
  a.args.amount = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => reviewedInstruction(a, snapshot, { now }));
  assert.equal(reviewerMember(snapshot, program), program);
  assert.throws(() => reviewerMember(snapshot, vault));
  assert.throws(() =>
    reviewerMember(
      {
        ...snapshot,
        governance: { members: [{ address: program, permissions: 1 }] },
      },
      program,
    ),
  );
});

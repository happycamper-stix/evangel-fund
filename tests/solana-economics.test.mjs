import test from "node:test";
import assert from "node:assert/strict";
import { FailedTransactionMetadata } from "litesvm";
import {
  getTransferCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token-2022";
import { setup, HASH } from "./support/solana-fixture.mjs";
import {
  pda,
  pub,
  integer,
  SYSTEM,
  TOKEN,
  sha256,
  feeDayAddresses,
  instruction,
  governedInstruction,
} from "../lib/solana/program.mjs";
const FOUNDATION = "92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc";
async function trade(f, amount = 1_000_000_000n, buy = true) {
  await f.initDay();
  await f.send(
    f.call(
      "swap",
      {
        buy,
        amount,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 100n,
      },
      [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
    ),
  );
  return { ...f.daily };
}
async function fails(f, ix, who = f.owner) {
  f.svm.expireBlockhash();
  assert.ok((await f.send(ix, who, true)) instanceof FailedTransactionMetadata);
}
function claim(f, name, d, recipient, who = f.worker) {
  return f.call(
    name,
    { day: d.day },
    [f.keys.project, d.feeDay, d.feeVault, f.quoteMint, recipient, TOKEN],
    who,
  );
}
async function expense(f, d, amount = 5_000_000n, invoice = HASH) {
  const receipt = await pda(f.program, "quote-expense", invoice);
  const ix = f.call(
    "approveQuoteExpense",
    { day: d.day, amount, invoice, report: HASH },
    [f.keys.project, d.feeDay, receipt, SYSTEM],
  );
  await f.send(ix);
  return receipt;
}
test("5% each side is backed by quote tokens; supply is never burned and SOL stays out of trading", async () => {
  const f = await setup(),
    initial = f.tokenBalance(f.quoteToken),
    sol = f.svm.getBalance(f.keys.project);
  const d = await trade(f);
  assert.equal(initial - f.tokenBalance(f.quoteToken), 1_000_000_000n);
  assert.equal(f.tokenBalance(f.keys.quotePool), 950_000_000n);
  assert.equal(f.tokenBalance(d.feeVault), 50_000_000n);
  assert.equal(f.svm.getBalance(f.keys.project), sol);
  assert.deepEqual(
    ["development", "community", "governance", "foundation"].map(
      (k) => f.read(d.feeDay)[k],
    ),
    ["30000000", "5000000", "13500000", "1500000"],
  );
  const before = f.read(f.keys.project),
    amount = f.tokenBalance(f.ownerToken);
  const gross =
    ((BigInt(before.virtualQuote) + BigInt(before.quoteReserve)) * amount) /
    (BigInt(before.tokenReserve) + amount);
  const outBefore = f.tokenBalance(f.quoteToken);
  await trade(f, amount, false);
  assert.equal(
    f.tokenBalance(f.quoteToken) - outBefore,
    gross - (gross + 19n) / 20n,
  );
  assert.equal(f.tokenBalance(d.feeVault), 50_000_000n + (gross + 19n) / 20n);
});
test("automatic development income requires verified adoption and only pays its fixed owner", async () => {
  const f = await setup(),
    d = await trade(f),
    workerQuote = await f.makeToken(f.worker, f.quoteMint);
  await fails(f, claim(f, "claimDevelopment", d, f.quoteToken));
  await f.adopt();
  await fails(f, claim(f, "claimDevelopment", d, workerQuote));
  const before = f.tokenBalance(f.quoteToken);
  await f.send(claim(f, "claimDevelopment", d, f.quoteToken), f.worker);
  assert.equal(f.tokenBalance(f.quoteToken) - before, 30_000_000n);
  await fails(f, claim(f, "claimDevelopment", d, f.quoteToken));
  const foundationQuote = await f.makeToken(
    { address: FOUNDATION },
    f.quoteMint,
  );
  await fails(f, claim(f, "claimQuoteFoundation", d, workerQuote));
  await f.send(claim(f, "claimQuoteFoundation", d, foundationQuote), f.worker);
  assert.equal(f.tokenBalance(foundationQuote), 1_500_000n);
});
test("daily close returns only unused governance and dust, is permissionless and replay protected", async () => {
  const f = await setup();
  await f.adopt();
  const d = await trade(f, 1001n);
  const ix = () =>
    f.call(
      "settleFeeDay",
      { day: d.day },
      [f.keys.project, d.feeDay],
      f.worker,
    );
  await fails(f, ix(), f.worker);
  const receipt = await expense(f, d, 5n);
  f.advance(3 * 86400);
  await f.send(ix(), f.worker);
  // Fee 51: dev30, community5, governance13, foundation1, dust2. Reserve expense5.
  assert.equal(f.read(d.feeDay).development, "40");
  assert.equal(f.read(d.feeDay).expenseCommitted, "5");
  assert.equal(f.read(d.feeDay).community, "5");
  assert.equal(f.read(d.feeDay).governance, "0");
  await fails(f, ix(), f.worker);
  await fails(
    f,
    f.call(
      "approveQuoteExpense",
      { day: d.day, amount: 1n, invoice: await sha256("late"), report: HASH },
      [
        f.keys.project,
        d.feeDay,
        await pda(f.program, "quote-expense", await sha256("late")),
        SYSTEM,
      ],
    ),
  );
  const before = f.tokenBalance(f.quoteToken);
  await f.send(claim(f, "claimDevelopment", d, f.quoteToken), f.worker);
  await f.send(
    f.call("claimQuoteExpense", { day: d.day }, [
      f.keys.project,
      d.feeDay,
      receipt,
      d.feeVault,
      f.quoteMint,
      f.quoteToken,
      TOKEN,
    ]),
  );
  assert.equal(f.tokenBalance(f.quoteToken) - before, 45n);
  assert.equal(f.tokenBalance(d.feeVault), 6n);
});
test("expenses cannot redirect recipients, overspend, duplicate invoices or consume another day", async () => {
  const f = await setup(),
    d = await trade(f),
    r = await pda(f.program, "quote-expense", HASH);
  const approve = (amount, who = f.owner) =>
    f.call(
      "approveQuoteExpense",
      { day: d.day, amount, invoice: HASH, report: HASH },
      [f.keys.project, d.feeDay, r, SYSTEM],
      who,
    );
  await fails(f, approve(1n, f.worker), f.worker);
  await fails(f, approve(13_500_001n));
  await f.send(approve(5_000_000n));
  await fails(f, approve(5_000_000n));
  const workerQuote = await f.makeToken(f.worker, f.quoteMint);
  const pay = (recipient) =>
    f.call("claimQuoteExpense", { day: d.day }, [
      f.keys.project,
      d.feeDay,
      r,
      d.feeVault,
      f.quoteMint,
      recipient,
      TOKEN,
    ]);
  await fails(f, pay(f.quoteToken));
  f.advance(2 * 86400);
  await fails(f, pay(workerQuote));
  const newDay = await f.initDay();
  await fails(
    f,
    f.call("claimQuoteExpense", { day: newDay.day }, [
      f.keys.project,
      newDay.feeDay,
      r,
      newDay.feeVault,
      f.quoteMint,
      f.quoteToken,
      TOKEN,
    ]),
  );
  await f.send(pay(f.quoteToken));
  await fails(f, pay(f.quoteToken));
  assert.equal(f.read(d.feeDay).expenseCommitted, "0");
});
test("canceled expenses return to the same project, including after daily settlement", async () => {
  const f = await setup(),
    d = await trade(f),
    r = await expense(f, d);
  f.advance(86400);
  await f.send(
    f.call("settleFeeDay", { day: d.day }, [f.keys.project, d.feeDay]),
  );
  const before = BigInt(f.read(d.feeDay).development);
  await fails(
    f,
    f.call(
      "cancelQuoteExpense",
      { day: d.day },
      [f.keys.project, d.feeDay, r],
      f.worker,
    ),
    f.worker,
  );
  await f.send(
    f.call("cancelQuoteExpense", { day: d.day }, [f.keys.project, d.feeDay, r]),
  );
  assert.equal(BigInt(f.read(d.feeDay).development), before + 5_000_000n);
  assert.equal(f.read(r).status, 2);
  await fails(
    f,
    f.call("cancelQuoteExpense", { day: d.day }, [f.keys.project, d.feeDay, r]),
  );
});
test("fee vault substitution, future days and cross-project days fail atomically", async () => {
  const f = await setup(),
    d = await trade(f);
  const other = await pda(
    f.program,
    "project",
    await sha256("https://github.com/example/other"),
  );
  await f.send(
    f.call(
      "registerFund",
      { name: "Other", source: "https://github.com/example/other" },
      [other, SYSTEM],
    ),
  );
  f.advance(86400);
  await fails(f, f.call("settleFeeDay", { day: d.day }, [other, d.feeDay]));
  const future = await feeDayAddresses(f.program, f.keys.project, d.day + 5n);
  await fails(
    f,
    f.call("initializeFeeDay", { day: d.day + 5n }, [
      f.keys.project,
      future.feeDay,
      future.feeVault,
      f.quoteMint,
      SYSTEM,
      TOKEN,
    ]),
  );
  await f.adopt();
  await fails(
    f,
    f.call("claimDevelopment", { day: d.day }, [
      f.keys.project,
      d.feeDay,
      f.keys.quotePool,
      f.quoteMint,
      f.quoteToken,
      TOKEN,
    ]),
  );
});
test("community quote awards use plan, delivery, challenge and fixed-recipient controls", async () => {
  const f = await setup();
  await f.adopt();
  const d = await trade(f);
  const ma = await pda(
    f.program,
    "milestone",
    pub(f.keys.project),
    integer(1n),
  );
  await f.send(
    f.call(
      "proposeQuoteMilestone",
      {
        day: d.day,
        amount: 2_000_000n,
        deadline: f.svm.getClock().unixTimestamp + 30n * 86400n,
        terms: HASH,
        uri: "https://github.com/example/oss/blob/commit/terms.json",
      },
      [f.keys.project, ma, SYSTEM],
    ),
  );
  await f.send(
    f.call("reviewMilestone", { approve: true, terms: HASH, report: HASH }, [
      f.keys.project,
      ma,
      d.feeDay,
    ]),
  );
  assert.equal(f.read(d.feeDay).community, "3000000");
  const workerQuote = await f.makeToken(f.worker, f.quoteMint);
  const pay = (recipient) =>
    f.call("pay", {}, [
      f.keys.project,
      ma,
      d.feeDay,
      d.feeVault,
      f.quoteMint,
      recipient,
      TOKEN,
    ]);
  await fails(f, pay(workerQuote));
  f.advance(2 * 86400);
  const submission = await f.submit(ma, f.worker);
  await f.award(ma, submission);
  await fails(f, pay(workerQuote));
  f.advance(2 * 86400);
  await fails(f, pay(f.quoteToken));
  await f.send(pay(workerQuote));
  assert.equal(f.tokenBalance(workerQuote), 2_000_000n);
  assert.equal(f.read(d.feeDay).communityCommitted, "0");
  await fails(f, pay(workerQuote));
});

test("developer payout accepts the real Token-2022 associated account used by wallets", async () => {
  const f = await setup();
  await f.adopt();
  const d = await trade(f);
  const ataProgram = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  const recipient = await pda(
    ataProgram,
    pub(f.owner.address),
    pub(TOKEN),
    pub(f.quoteMint),
  );
  await f.send(
    getCreateAssociatedTokenIdempotentInstruction(
      {
        payer: f.owner,
        ata: recipient,
        owner: f.owner.address,
        mint: f.quoteMint,
      },
      { programAddress: ataProgram },
    ),
  );
  assert.ok(f.svm.getAccount(recipient).data.length > 165);
  await f.send(claim(f, "claimDevelopment", d, recipient), f.worker);
  assert.equal(f.tokenBalance(recipient), 30_000_000n);
});

test("real Squads approves an incurred invoice for a future booking day and preserves it through close", async () => {
  const f = await setup({ quorum: true });
  const { createProposal, approveProposal, executeProposal } =
    await import("../lib/solana/squads.mjs");
  const bookingDay = f.svm.getClock().unixTimestamp / 86400n + 2n;
  const d = {
    ...(await feeDayAddresses(f.program, f.keys.project, bookingDay)),
    day: bookingDay,
  };
  const receipt = await pda(f.program, "quote-expense", HASH);
  const action = governedInstruction(
    f.program,
    "approveQuoteExpense",
    { day: bookingDay, amount: 5_000_000n, invoice: HASH, report: HASH },
    [
      f.authority,
      f.fa,
      f.keys.project,
      d.feeDay,
      receipt,
      SYSTEM,
      f.governanceMultisig,
    ],
    f.svm.getClock().unixTimestamp + 7n * 86400n,
  );
  const plan = await createProposal({
    multisig: f.governanceMultisig,
    index: 1n,
    member: f.owner,
    instruction: action,
  });
  await f.send([plan.create, plan.propose]);
  await f.send(
    await approveProposal({
      multisig: f.governanceMultisig,
      index: 1n,
      member: f.owner,
    }),
  );
  await f.send(
    await approveProposal({
      multisig: f.governanceMultisig,
      index: 1n,
      member: f.worker,
    }),
    f.worker,
  );
  const execute = await executeProposal({
    multisig: f.governanceMultisig,
    index: 1n,
    member: f.owner,
    instruction: action,
  });
  await fails(f, execute);
  f.advance(2 * 86400);
  await trade(f);
  await f.send(execute);
  assert.equal(f.read(d.feeDay).expenseCommitted, "5000000");
  f.advance(86400);
  await f.send(
    f.call("settleFeeDay", { day: bookingDay }, [f.keys.project, d.feeDay]),
  );
  assert.equal(f.read(d.feeDay).development, "38500000");
  assert.equal(f.read(d.feeDay).expenseCommitted, "5000000");
  const recipient = await f.makeToken({ address: f.authority }, f.quoteMint);
  const pay = f.call("claimQuoteExpense", { day: bookingDay }, [
    f.keys.project,
    d.feeDay,
    receipt,
    d.feeVault,
    f.quoteMint,
    recipient,
    TOKEN,
  ]);
  await fails(f, pay);
  f.advance(86400);
  await f.send(pay);
  assert.equal(f.tokenBalance(recipient), 5_000_000n);
  await fails(f, pay);
  await fails(f, execute);
});

test("daily expense cap cannot be bypassed by splitting or canceling invoices", async () => {
  const f = await setup(),
    d = await trade(f, 10_000_000_000n);
  const r = await expense(f, d, 100_000_000n);
  const second = await sha256("second invoice"),
    receipt = await pda(f.program, "quote-expense", second);
  const approve = f.call(
    "approveQuoteExpense",
    { day: d.day, amount: 1n, invoice: second, report: HASH },
    [f.keys.project, d.feeDay, receipt, SYSTEM],
  );
  await fails(f, approve);
  await f.send(
    f.call("cancelQuoteExpense", { day: d.day }, [f.keys.project, d.feeDay, r]),
  );
  await fails(f, approve);
});
test("v3 refuses legacy factory state rather than reinterpreting old SOL fee balances", async () => {
  const f = await setup();
  const raw = f.svm.getAccount(f.fa),
    bytes = new Uint8Array(raw.data);
  bytes[0] = 1;
  f.svm.setAccount({ ...raw, data: bytes });
  await fails(f, f.call("requestAdoption", { terms: HASH }, [f.keys.project]));
});

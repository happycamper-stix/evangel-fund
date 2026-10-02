import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getTransactionEncoder,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { loadSquads } from "./support/squads-fixture.mjs";
import {
  SQUADS,
  FOUNDATION,
  TIMELOCK,
  createMultisig,
  squadAddress,
  vaultAddress,
  decodeMultisig,
  assertSafeMultisig,
  createProposal,
  approveProposal,
  executeProposal,
  assertTransactionMatches,
} from "../lib/solana/squads.mjs";
import {
  pda,
  pub,
  integer,
  instruction,
  governedInstruction,
  decodeAccount,
  SYSTEM,
  LOADER,
  sha256,
} from "../lib/solana/program.mjs";
test("real Squads v4 enforces independent quorum and timelock before Evangel governance", async () => {
  const svm = new LiteSVM(),
    one = await generateKeyPairSigner(),
    two = await generateKeyPairSigner(),
    key = await generateKeyPairSigner(),
    program = (await generateKeyPairSigner()).address;
  svm.airdrop(one.address, 100_000_000_000n);
  svm.airdrop(two.address, 1_000_000_000n);
  const { treasury } = await loadSquads(svm);
  async function send(instructions, payer = one, fail = false) {
    let msg = setTransactionMessageFeePayerSigner(
      payer,
      createTransactionMessage({ version: 0 }),
    );
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstructions(
      Array.isArray(instructions) ? instructions : [instructions],
      msg,
    );
    const transaction = await signTransactionMessageWithSigners(msg);
    assert.ok(getTransactionEncoder().encode(transaction).length <= 1232);
    const result = svm.sendTransaction(transaction);
    if (!fail)
      assert.ok(
        !(result instanceof FailedTransactionMetadata),
        result instanceof FailedTransactionMetadata
          ? result.meta().logs().join("\n")
          : "",
      );
    return result;
  }
  await send(
    await createMultisig({
      creator: one,
      createKey: key,
      treasury,
      members: [FOUNDATION, one.address, two.address],
    }),
  );
  const multisig = await squadAddress(key.address),
    vault = await vaultAddress(multisig);
  const state = assertSafeMultisig(
    await decodeMultisig(multisig, svm.getAccount(multisig)),
  );
  assert.equal(state.timeLock, TIMELOCK);
  await send(
    getTransferSolInstruction({
      source: one,
      destination: vault,
      amount: 1_000_000_000n,
    }),
  );
  svm.addProgram(
    program,
    new Uint8Array(
      await readFile("solana/program/target/deploy/evangel_factory.so"),
    ),
  );
  const pd = await pda(LOADER, pub(program)),
    a = svm.getAccount(pd),
    bytes = new Uint8Array(a.data);
  bytes[12] = 1;
  bytes.set(pub(one.address), 13);
  svm.setAccount({ ...a, data: bytes });
  const fa = await pda(program, "factory"),
    burn = (await generateKeyPairSigner()).address;
  assert.ok(
    (await send(
      instruction(
        program,
        "initialize",
        {
          authority: one.address,
          quoteMint: burn,
          testMode: true,
          governanceMultisig: SYSTEM,
        },
        [one.address, fa, SYSTEM, pd],
        [one],
      ),
      one,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(svm.getAccount(fa).exists, false);
  await send(
    instruction(
      program,
      "initialize",
      {
        authority: vault,
        quoteMint: burn,
        testMode: true,
        governanceMultisig: multisig,
      },
      [one.address, fa, SYSTEM, pd, multisig],
      [one],
    ),
  );
  assert.ok(
    (await send(
      instruction(
        program,
        "launch",
        {
          name: "Blocked",
          symbol: "BLOCK",
          source: "https://github.com/example/blocked",
          virtualQuote: 1_000_000_000n,
        },
        [one.address, fa],
        [one],
      ),
      one,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(decodeAccount(svm.getAccount(fa).data).count, "0");
  const hash = await sha256("verified repo terms");
  const source = "https://github.com/example/repository";
  const project = await pda(program, "project", await sha256(source));
  await send(
    instruction(
      program,
      "registerFund",
      { name: "Repository", source },
      [one.address, fa, project, SYSTEM],
      [one],
    ),
  );
  await send(
    instruction(
      program,
      "requestAdoption",
      { terms: hash },
      [one.address, fa, project],
      [one],
    ),
  );
  const args = { nonce: 1n, owner: one.address, terms: hash, report: hash };
  assert.ok(
    (await send(
      instruction(
        program,
        "approveAdoption",
        args,
        [one.address, fa, project, multisig],
        [one],
      ),
      one,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  const action = governedInstruction(
    program,
    "approveAdoption",
    args,
    [vault, fa, project, multisig],
    svm.getClock().unixTimestamp + 7n * 86400n,
  );
  const plan = await createProposal({
    multisig,
    index: 1n,
    member: one,
    instruction: action,
  });
  await send([plan.create, plan.propose]);
  await assertTransactionMatches({
    multisig,
    index: 1n,
    instruction: action,
    account: svm.getAccount(plan.transaction),
  });
  await assert.rejects(
    assertTransactionMatches({
      multisig,
      index: 1n,
      instruction: { ...action, data: Uint8Array.of(3) },
      account: svm.getAccount(plan.transaction),
    }),
  );
  await send(await approveProposal({ multisig, index: 1n, member: one }));
  const execute = await executeProposal({
    multisig,
    index: 1n,
    member: one,
    instruction: action,
  });
  assert.ok(
    (await send(execute, one, true)) instanceof FailedTransactionMetadata,
  );
  await send(await approveProposal({ multisig, index: 1n, member: two }), two);
  svm.expireBlockhash();
  assert.ok(
    (await send(execute, one, true)) instanceof FailedTransactionMetadata,
  );
  const clock = svm.getClock();
  clock.unixTimestamp += BigInt(TIMELOCK);
  svm.setClock(clock);
  svm.expireBlockhash();
  const safeAccount = svm.getAccount(multisig),
    unsafeData = new Uint8Array(safeAccount.data);
  new DataView(unsafeData.buffer).setUint16(72, 1, true);
  svm.setAccount({ ...safeAccount, data: unsafeData });
  assert.ok(
    (await send(execute, one, true)) instanceof FailedTransactionMetadata,
  );
  svm.setAccount(safeAccount);
  svm.expireBlockhash();
  await send(execute);
  assert.ok(
    BigInt(decodeAccount(svm.getAccount(project).data).adoptionAt) >
      clock.unixTimestamp,
  );
  svm.expireBlockhash();
  assert.ok(
    (await send(execute, one, true)) instanceof FailedTransactionMetadata,
  );
  const expiredAction = governedInstruction(
    program,
    "rejectAdoption",
    { report: hash },
    [vault, fa, project, multisig],
    svm.getClock().unixTimestamp + BigInt(TIMELOCK) - 1n,
  );
  const expiredPlan = await createProposal({
    multisig,
    index: 2n,
    member: one,
    instruction: expiredAction,
  });
  await send([expiredPlan.create, expiredPlan.propose]);
  await send(await approveProposal({ multisig, index: 2n, member: one }));
  await send(await approveProposal({ multisig, index: 2n, member: two }), two);
  const later = svm.getClock();
  later.unixTimestamp += BigInt(TIMELOCK);
  svm.setClock(later);
  svm.expireBlockhash();
  assert.ok(
    (await send(
      await executeProposal({
        multisig,
        index: 2n,
        member: one,
        instruction: expiredAction,
      }),
      one,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  // Adopt and fund actual community work; known reviewers cannot be claimants.
  await send(
    instruction(
      program,
      "finalizeAdoption",
      {},
      [one.address, fa, project],
      [one],
    ),
  );
  const receipt = await pda(
    program,
    "sponsor",
    pub(project),
    pub(two.address),
    integer(1),
  );
  await send(
    instruction(
      program,
      "sponsor",
      { amount: 500_000_000n, nonce: 1n },
      [two.address, fa, project, receipt, SYSTEM],
      [two],
    ),
    two,
  );
  const settleClock = svm.getClock();
  settleClock.unixTimestamp += 86400n;
  svm.setClock(settleClock);
  svm.expireBlockhash();
  await send(
    instruction(
      program,
      "settleSponsorship",
      { refund: false },
      [one.address, fa, project, receipt],
      [one],
    ),
  );
  const milestone = await pda(program, "milestone", pub(project), integer(1));
  await send(
    instruction(
      program,
      "proposeMilestone",
      {
        community: true,
        solReward: true,
        amount: 500_000_000n,
        deadline: svm.getClock().unixTimestamp + 30n * 86400n,
        terms: hash,
        uri:
          "https://github.com/example/repository/blob/" +
          "a".repeat(40) +
          "/milestone.json",
      },
      [one.address, fa, project, milestone, SYSTEM],
      [one],
    ),
  );
  const review = governedInstruction(
    program,
    "reviewMilestone",
    { approve: true, terms: hash, report: hash },
    [vault, fa, project, milestone, multisig],
    svm.getClock().unixTimestamp + 7n * 86400n,
  );
  const reviewPlan = await createProposal({
    multisig,
    index: 3n,
    member: one,
    instruction: review,
  });
  await send([reviewPlan.create, reviewPlan.propose]);
  await send(await approveProposal({ multisig, index: 3n, member: one }));
  await send(await approveProposal({ multisig, index: 3n, member: two }), two);
  const reviewClock = svm.getClock();
  reviewClock.unixTimestamp += BigInt(TIMELOCK);
  svm.setClock(reviewClock);
  svm.expireBlockhash();
  await send(
    await executeProposal({
      multisig,
      index: 3n,
      member: one,
      instruction: review,
    }),
  );
  reviewClock.unixTimestamp += BigInt(TIMELOCK);
  svm.setClock(reviewClock);
  svm.expireBlockhash();
  const work = await pda(
    program,
    "work",
    pub(milestone),
    pub(two.address),
    integer(0),
  );
  assert.ok(
    (await send(
      instruction(
        program,
        "submitWork",
        { evidence: hash },
        [two.address, fa, project, milestone, work, SYSTEM, multisig],
        [two],
      ),
      two,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  const outsider = await generateKeyPairSigner();
  svm.airdrop(outsider.address, 1_000_000_000n);
  const outsiderWork = await pda(
    program,
    "work",
    pub(milestone),
    pub(outsider.address),
    integer(0),
  );
  await send(
    instruction(
      program,
      "submitWork",
      { evidence: hash },
      [
        outsider.address,
        fa,
        project,
        milestone,
        outsiderWork,
        SYSTEM,
        multisig,
      ],
      [outsider],
    ),
    outsider,
  );
});

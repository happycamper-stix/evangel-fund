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
} from "@solana/kit";
import { upgradeActions } from "../lib/solana/upgrade-plan.mjs";
import { LOADER, pda, pub } from "../lib/solana/program.mjs";

test("loader extension preserves bytes and upgrade rejects the wrong authority", async () => {
  const svm = new LiteSVM();
  const owner = await generateKeyPairSigner(),
    outsider = await generateKeyPairSigner();
  const program = (await generateKeyPairSigner()).address,
    buffer = (await generateKeyPairSigner()).address;
  svm.airdrop(owner.address, 100_000_000_000n);
  svm.airdrop(outsider.address, 1_000_000_000n);
  const bytes = new Uint8Array(
    await readFile(".evangel/test-programs/evangel_factory.so"),
  );
  svm.addProgram(program, bytes);
  const programData = await pda(LOADER, pub(program));
  const pd = svm.getAccount(programData),
    data = new Uint8Array(pd.data);
  data[12] = 1;
  data.set(pub(owner.address), 13);
  svm.setAccount({ ...pd, data });
  const bufferData = new Uint8Array(bytes.length + 37);
  new DataView(bufferData.buffer).setUint32(0, 1, true);
  bufferData[4] = 1;
  bufferData.set(pub(owner.address), 5);
  bufferData.set(bytes, 37);
  svm.setAccount({
    address: buffer,
    programAddress: LOADER,
    lamports: 10_000_000_000n,
    executable: false,
    data: bufferData,
  });
  const actions = upgradeActions({
    program,
    programData,
    buffer,
    authority: owner.address,
    refundRecipient: owner.address,
    additionalBytes: 40648,
  });
  async function send(ix, s) {
    let msg = setTransactionMessageFeePayerSigner(
      s,
      createTransactionMessage({ version: 0 }),
    );
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstructions(
      [
        {
          ...ix,
          accounts: ix.accounts.map((a) =>
            a.role >= 2 ? { ...a, address: s.address, signer: s } : a,
          ),
        },
      ],
      msg,
    );
    return svm.sendTransaction(await signTransactionMessageWithSigners(msg));
  }
  svm.warpToSlot(10n);
  for (const ix of actions) {
    if (ix.name === "Upgrade")
      assert.ok(
        (await send(ix, outsider)) instanceof FailedTransactionMetadata,
      );
    svm.expireBlockhash();
    const result = await send(ix, owner);
    assert.ok(
      !(result instanceof FailedTransactionMetadata),
      result instanceof FailedTransactionMetadata
        ? result.meta().logs().join("\n")
        : "",
    );
    svm.expireBlockhash();
    svm.warpToSlot(svm.getClock().slot + 1n);
  }
  const final = svm.getAccount(programData).data;
  assert.deepEqual(new Uint8Array(final.slice(45, 45 + bytes.length)), bytes);
  assert.ok(final.slice(45 + bytes.length).every((b) => b === 0));
  assert.equal(final.length, data.length + 40648);
});

test("upgrade planning rejects invalid extension sizes and omits unnecessary extension", () => {
  const args = {
    program: "p",
    programData: "d",
    buffer: "b",
    authority: "a",
    refundRecipient: "r",
  };
  for (const additionalBytes of [-1, 0.5, NaN, 0x100000000])
    assert.throws(
      () => upgradeActions({ ...args, additionalBytes }),
      /Invalid program extension/,
    );
  assert.deepEqual(
    upgradeActions({ ...args, additionalBytes: 0 }).map((a) => a.name),
    ["Upgrade"],
  );
});

test("Squads executes the exact loader plan only after quorum and timelock", async () => {
  const { loadSquads } = await import("./support/squads-fixture.mjs");
  const {
    FOUNDATION,
    TIMELOCK,
    createMultisig,
    squadAddress,
    vaultAddress,
    createProposal,
    approveProposal,
    executeProposal,
    assertTransactionMatches,
  } = await import("../lib/solana/squads.mjs");
  const svm = new LiteSVM(),
    one = await generateKeyPairSigner(),
    two = await generateKeyPairSigner(),
    key = await generateKeyPairSigner();
  svm.airdrop(one.address, 100_000_000_000n);
  svm.airdrop(two.address, 10_000_000_000n);
  const { treasury } = await loadSquads(svm);
  async function send(ixs, payer = one, fail = false) {
    let msg = setTransactionMessageFeePayerSigner(
      payer,
      createTransactionMessage({ version: 0 }),
    );
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstructions(
      Array.isArray(ixs) ? ixs : [ixs],
      msg,
    );
    const result = svm.sendTransaction(
      await signTransactionMessageWithSigners(msg),
    );
    svm.expireBlockhash();
    if (fail) assert.ok(result instanceof FailedTransactionMetadata);
    else
      assert.ok(
        !(result instanceof FailedTransactionMetadata),
        result instanceof FailedTransactionMetadata
          ? result.meta().logs().join("\n")
          : "",
      );
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
  svm.airdrop(vault, 10_000_000_000n);
  const program = (await generateKeyPairSigner()).address,
    buffer = (await generateKeyPairSigner()).address,
    bytes = new Uint8Array(
      await readFile(".evangel/test-programs/evangel_factory.so"),
    );
  svm.addProgram(program, bytes);
  const programData = await pda(LOADER, pub(program)),
    pd = svm.getAccount(programData),
    data = new Uint8Array(pd.data);
  data[12] = 1;
  data.set(pub(vault), 13);
  svm.setAccount({ ...pd, data });
  const bufferData = new Uint8Array(bytes.length + 37);
  new DataView(bufferData.buffer).setUint32(0, 1, true);
  bufferData[4] = 1;
  bufferData.set(pub(vault), 5);
  bufferData.set(bytes, 37);
  svm.setAccount({
    address: buffer,
    programAddress: LOADER,
    lamports: 10_000_000_000n,
    executable: false,
    data: bufferData,
  });
  svm.warpToSlot(10n);
  const extension = upgradeActions({
    program,
    programData,
    buffer,
    authority: one.address,
    refundRecipient: one.address,
    additionalBytes: 40648,
  })[0];
  await send({
    ...extension,
    accounts: extension.accounts.map((a) =>
      a.role >= 2 ? { ...a, signer: one } : a,
    ),
  });
  svm.warpToSlot(svm.getClock().slot + 1n);
  let index = 0n;
  for (const instruction of upgradeActions({
    program,
    programData,
    buffer,
    authority: vault,
    refundRecipient: one.address,
    additionalBytes: 0,
  })) {
    index++;
    const plan = await createProposal({
      multisig,
      index,
      member: one,
      instruction,
    });
    await send([plan.create, plan.propose]);
    await assertTransactionMatches({
      multisig,
      index,
      instruction,
      account: svm.getAccount(plan.transaction),
    });
    await send(await approveProposal({ multisig, index, member: one }));
    const execute = await executeProposal({
      multisig,
      index,
      member: one,
      instruction,
    });
    await send(execute, one, true);
    await send(await approveProposal({ multisig, index, member: two }), two);
    await send(execute, one, true);
    const clock = svm.getClock();
    clock.unixTimestamp += BigInt(TIMELOCK);
    svm.setClock(clock);
    await send(execute);
    svm.warpToSlot(svm.getClock().slot + 1n);
  }
  assert.deepEqual(
    new Uint8Array(
      svm.getAccount(programData).data.slice(45, 45 + bytes.length),
    ),
    bytes,
  );
  assert.equal(svm.getAccount(programData).data.length, data.length + 40648);
});

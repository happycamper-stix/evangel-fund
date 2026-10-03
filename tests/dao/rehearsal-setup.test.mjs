import test from "node:test";
import assert from "node:assert/strict";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  rehearsalMintInstructions,
  rehearsalAllocationInstructions,
  rehearsalTokenAccount,
  revokeRehearsalMint,
  REHEARSAL_SUPPLY,
} from "../../lib/solana/rehearsal-setup.mjs";
import { inspectDaoMint } from "../../lib/solana/dao-mint.mjs";
import { TOKEN } from "../../lib/solana/program.mjs";
test("rehearsal creates immutable metadata mint, fixed allocations and real ImmutableOwner accounts", async () => {
  const svm = new LiteSVM(),
    payer = await generateKeyPairSigner(),
    mint = await generateKeyPairSigner();
  svm.airdrop(payer.address, 100_000_000_000n);
  async function send(ixs) {
    svm.expireBlockhash();
    let m = setTransactionMessageFeePayerSigner(
      payer,
      createTransactionMessage({ version: 0 }),
    );
    m = svm.setTransactionMessageLifetimeUsingLatestBlockhash(m);
    m = appendTransactionMessageInstructions(ixs, m);
    const result = svm.sendTransaction(
      await signTransactionMessageWithSigners(m),
    );
    assert.ok(
      !(result instanceof FailedTransactionMetadata),
      result instanceof FailedTransactionMetadata
        ? result.meta().logs().join("\n")
        : "",
    );
  }
  await send(rehearsalMintInstructions({ payer, mint, rent: 10_000_000 }));
  let total = 0n;
  for (let i = 0; i < 4; i++) {
    const owner = (await generateKeyPairSigner()).address,
      amount = i === 0 ? 4_200_000_000_000n : 5_600_000_000_000n;
    total += amount;
    await send(
      await rehearsalAllocationInstructions({
        payer,
        mint: mint.address,
        owner,
        amount,
      }),
    );
    const a = svm.getAccount(await rehearsalTokenAccount(mint.address, owner)),
      d = Buffer.from(a.data);
    assert.equal(d.readBigUInt64LE(64), amount);
    assert.deepEqual([...d.subarray(165)], [2, 7, 0, 0, 0]);
    assert.equal(svm.getBalance(owner), 20_000_000n);
  }
  assert.equal(total, REHEARSAL_SUPPLY);
  await send([revokeRehearsalMint(mint.address, payer)]);
  const a = svm.getAccount(mint.address);
  const inspection = inspectDaoMint(
    { owner: TOKEN, executable: false, data: a.data },
    mint.address,
  );
  assert.equal(inspection.compatible, true);
  assert.equal(inspection.supply, REHEARSAL_SUPPLY.toString());
});

test("loader rehearsal deployment and authority removal use the actual loader", async () => {
  const { readFile } = await import("node:fs/promises");
  const { deployRehearsalTargetInstructions, loaderAuthorityInstruction } =
    await import("../../lib/solana/rehearsal-setup.mjs");
  const { LOADER, pub, pda } = await import("../../lib/solana/program.mjs");
  const svm = new LiteSVM(),
    payer = await generateKeyPairSigner(),
    target = await generateKeyPairSigner(),
    buffer = await generateKeyPairSigner();
  svm.airdrop(payer.address, 100_000_000_000n);
  svm.airdrop(buffer.address, 10_000_000_000n);
  const code = await readFile(".evangel/dao-programs/evangel_dao.so"),
    data = Buffer.alloc(code.length + 37);
  data.writeUInt32LE(1);
  data[4] = 1;
  data.set(pub(payer.address), 5);
  data.set(code, 37);
  svm.setAccount({
    ...svm.getAccount(buffer.address),
    programAddress: LOADER,
    data,
  });
  async function send(ixs) {
    svm.expireBlockhash();
    let m = setTransactionMessageFeePayerSigner(
      payer,
      createTransactionMessage({ version: 0 }),
    );
    m = svm.setTransactionMessageLifetimeUsingLatestBlockhash(m);
    m = appendTransactionMessageInstructions(ixs, m);
    const result = svm.sendTransaction(
      await signTransactionMessageWithSigners(m),
    );
    assert.ok(
      !(result instanceof FailedTransactionMetadata),
      result instanceof FailedTransactionMetadata
        ? result.meta().logs().join("\n")
        : "",
    );
  }
  await send(
    await deployRehearsalTargetInstructions({
      payer,
      target,
      buffer: buffer.address,
      rent: 10_000_000,
      length: code.length * 2,
    }),
  );
  const pd = await pda(LOADER, pub(target.address));
  assert.equal(Buffer.from(svm.getAccount(pd).data)[12], 1);
  await send([loaderAuthorityInstruction(pd, payer, null)]);
  assert.equal(Buffer.from(svm.getAccount(pd).data)[12], 0);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import {
  getInitializeAccount3Instruction,
  getTokenDecoder,
  getMintDecoder,
  getMintToCheckedInstruction,
  getFreezeAccountInstruction,
  getInitializeMint2Instruction,
  getSetAuthorityInstruction,
} from "@solana-program/token-2022";
import {
  pda,
  pub,
  integer,
  launchAddresses,
  instruction,
  decodeAccount,
  TOKEN,
  SYSTEM,
  LOADER,
  sha256,
  feeDayAddresses,
} from "../../lib/solana/program.mjs";
export const HASH = await sha256("fixture terms and report");
export async function setup({ prefund = false, quorum = false } = {}) {
  const svm = new LiteSVM(),
    owner = await generateKeyPairSigner(),
    worker = await generateKeyPairSigner(),
    program = (await generateKeyPairSigner()).address;
  svm.airdrop(owner.address, 100_000_000_000n);
  svm.airdrop(worker.address, 10_000_000_000n);
  svm.addProgram(
    program,
    new Uint8Array(await readFile(".evangel/test-programs/evangel_factory.so")),
  );
  // Model only deployment metadata: the VM loads the actual SBF, then assigns its upgrade authority.
  const pd = await pda(LOADER, pub(program)),
    a = svm.getAccount(pd);
  assert.ok(a.exists);
  const bytes = new Uint8Array(a.data);
  bytes[12] = 1;
  bytes.set(pub(owner.address), 13);
  svm.setAccount({ ...a, data: bytes });
  const fa = await pda(program, "factory"),
    quoteSigner = await generateKeyPairSigner(),
    quoteMint = quoteSigner.address;
  async function send(ix, payer = owner, fail = false) {
    let msg = setTransactionMessageFeePayerSigner(
      payer,
      createTransactionMessage({ version: 0 }),
    );
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstructions(
      Array.isArray(ix) ? ix : [ix],
      msg,
    );
    const tx = await signTransactionMessageWithSigners(msg);
    assert.ok(
      Buffer.from(getBase64EncodedWireTransaction(tx), "base64").length <= 1232,
    );
    const result = svm.sendTransaction(tx);
    if (!fail)
      assert.ok(
        !(result instanceof FailedTransactionMetadata),
        result instanceof FailedTransactionMetadata
          ? `${result.err()} ${result.meta().logs().join("\n")}`
          : "",
      );
    return result;
  }
  let quoteToken,
    keys,
    currentDay,
    governanceMultisig = SYSTEM,
    authority = owner.address;
  if (quorum) {
    const { loadSquads } = await import("./squads-fixture.mjs");
    const { createMultisig, squadAddress, vaultAddress, FOUNDATION } =
      await import("../../lib/solana/squads.mjs");
    const { treasury } = await loadSquads(svm),
      createKey = await generateKeyPairSigner();
    await send(
      await createMultisig({
        creator: owner,
        createKey,
        treasury,
        members: [FOUNDATION, owner.address, worker.address],
      }),
    );
    governanceMultisig = await squadAddress(createKey.address);
    authority = await vaultAddress(governanceMultisig);
    await send(
      getTransferSolInstruction({
        source: owner,
        destination: authority,
        amount: 1_000_000_000n,
      }),
    );
  }
  const call = (name, args, acc, who = owner) => {
    if (name === "swap")
      acc = [
        ...acc,
        quoteMint,
        keys.quotePool,
        quoteToken,
        currentDay.feeDay,
        currentDay.feeVault,
      ];
    return instruction(program, name, args, [who.address, fa, ...acc], [who]);
  };
  await send([
    getCreateAccountInstruction({
      payer: owner,
      newAccount: quoteSigner,
      lamports: svm.minimumBalanceForRentExemption(82n),
      space: 82n,
      programAddress: TOKEN,
    }),
    getInitializeMint2Instruction({
      mint: quoteMint,
      decimals: 6,
      mintAuthority: owner.address,
      freezeAuthority: null,
    }),
  ]);
  async function makeToken(who, mint) {
    const account = await generateKeyPairSigner();
    await send([
      getCreateAccountInstruction({
        payer: owner,
        newAccount: account,
        lamports: svm.minimumBalanceForRentExemption(165n),
        space: 165n,
        programAddress: TOKEN,
      }),
      getInitializeAccount3Instruction({
        account: account.address,
        mint,
        owner: who.address,
      }),
    ]);
    return account.address;
  }
  quoteToken = await makeToken(owner, quoteMint);
  await send([
    getMintToCheckedInstruction({
      mint: quoteMint,
      token: quoteToken,
      mintAuthority: owner,
      amount: 1_000_000_000_000n,
      decimals: 6,
    }),
    getSetAuthorityInstruction({
      owned: quoteMint,
      owner,
      authorityType: 0,
      newAuthority: null,
    }),
  ]);
  await send(
    call(
      "initialize",
      {
        authority,
        quoteMint,
        testMode: true,
        governanceMultisig,
      },
      [SYSTEM, pd, ...(quorum ? [governanceMultisig] : [])],
    ),
  );
  keys = await launchAddresses(program, owner.address, 0);
  if (prefund)
    for (const destination of [
      keys.project,
      keys.mint,
      keys.pool,
      keys.reserve,
    ])
      await send(
        getTransferSolInstruction({
          source: worker,
          destination,
          amount: svm.minimumBalanceForRentExemption(0n),
        }),
        worker,
      );
  await send(
    call(
      "launch",
      {
        name: "OSS work",
        symbol: "WORK",
        source: "https://github.com/example/oss",
        virtualQuote: 1_000_000_000n,
      },
      [
        keys.project,
        keys.mint,
        keys.pool,
        keys.reserve,
        SYSTEM,
        TOKEN,
        quoteMint,
        keys.quotePool,
      ],
    ),
  );
  async function initDay() {
    const day = svm.getClock().unixTimestamp / 86400n;
    currentDay = {
      ...(await feeDayAddresses(program, keys.project, day)),
      day,
    };
    if (!svm.getAccount(currentDay.feeDay).exists)
      await send(
        call("initializeFeeDay", { day }, [
          keys.project,
          currentDay.feeDay,
          currentDay.feeVault,
          quoteMint,
          SYSTEM,
          TOKEN,
        ]),
      );
    return currentDay;
  }
  await initDay();
  const read = (key) => decodeAccount(svm.getAccount(key).data);
  const tokenBalance = (key) =>
    getTokenDecoder().decode(svm.getAccount(key).data).amount;
  async function tokenAccount(who) {
    const account = await generateKeyPairSigner();
    await send([
      getCreateAccountInstruction({
        payer: owner,
        newAccount: account,
        lamports: svm.minimumBalanceForRentExemption(165n),
        space: 165n,
        programAddress: TOKEN,
      }),
      getInitializeAccount3Instruction({
        account: account.address,
        mint: keys.mint,
        owner: who.address,
      }),
    ]);
    return account.address;
  }
  const ownerToken = await tokenAccount(owner),
    workerToken = await tokenAccount(worker);
  function advance(seconds) {
    const clock = svm.getClock();
    clock.unixTimestamp += BigInt(seconds);
    svm.setClock(clock);
    svm.expireBlockhash();
  }
  async function adopt() {
    await send(call("requestAdoption", { terms: HASH }, [keys.project]));
    await send(
      call(
        "approveAdoption",
        { nonce: 1n, owner: owner.address, terms: HASH, report: HASH },
        [keys.project],
      ),
    );
    advance(2 * 86400);
    await send(
      call("finalizeAdoption", {}, [
        keys.project,
        keys.mint,
        keys.reserve,
        ownerToken,
        TOKEN,
      ]),
    );
  }
  async function propose(
    community = false,
    solReward = false,
    amount = 100_000_000_000n,
  ) {
    const id = BigInt(read(keys.project).milestoneCount) + 1n,
      ma = await pda(program, "milestone", pub(keys.project), integer(id));
    await send(
      call(
        "proposeMilestone",
        {
          community,
          solReward,
          amount,
          deadline: svm.getClock().unixTimestamp + 30n * 86400n,
          terms: HASH,
          uri: "https://github.com/example/oss/blob/commit/milestone.json",
        },
        [keys.project, ma, SYSTEM],
      ),
    );
    await send(
      call("reviewMilestone", { approve: true, terms: HASH, report: HASH }, [
        keys.project,
        ma,
      ]),
    );
    return ma;
  }
  async function submit(ma, who) {
    const revision = BigInt(read(ma).revision),
      sa = await pda(
        program,
        "work",
        pub(ma),
        pub(who.address),
        integer(revision),
      );
    await send(
      call(
        "submitWork",
        { evidence: HASH },
        [keys.project, ma, sa, SYSTEM],
        who,
      ),
      who,
    );
    return sa;
  }
  async function award(ma, sa) {
    await send(
      call(
        "award",
        { revision: BigInt(read(ma).revision), evidence: HASH, report: HASH },
        [keys.project, ma, sa],
      ),
    );
  }
  return {
    svm,
    initDay,
    governanceMultisig,
    authority,
    get daily() {
      return currentDay;
    },
    quoteToken,
    makeToken,
    quoteSigner,
    quoteMint,
    owner,
    worker,
    program,
    fa,
    keys,
    ownerToken,
    workerToken,
    send,
    call,
    read,
    tokenBalance,
    advance,
    adopt,
    propose,
    submit,
    award,
  };
}

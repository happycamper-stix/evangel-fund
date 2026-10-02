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
} from "../lib/solana/program.mjs";
import { setup, HASH } from "./support/solana-fixture.mjs";

test("native factory mints 21M once, seeds only tokens, collects real e/acc and splits fees", async () => {
  const f = await setup();
  const mint = getMintDecoder().decode(f.svm.getAccount(f.keys.mint).data);
  assert.equal(mint.supply, 21_000_000_000_000n);
  assert.equal(mint.mintAuthority.__option, "None");
  assert.equal(mint.freezeAuthority.__option, "None");
  assert.equal(f.tokenBalance(f.keys.pool), 14_700_000_000_000n);
  assert.equal(f.tokenBalance(f.keys.reserve), 6_300_000_000_000n);
  assert.equal(f.read(f.keys.project).quoteReserve, "0");
  await f.send(
    f.call(
      "swap",
      {
        buy: true,
        amount: 1_000_000_000n,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 100n,
      },
      [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
    ),
  );
  assert.equal(f.read(f.keys.project).quoteReserve, "950000000");
  assert.equal(f.read(f.daily.feeDay).development, "30000000");
  assert.equal(f.read(f.daily.feeDay).community, "5000000");
  assert.equal(f.read(f.daily.feeDay).governance, "13500000");
  assert.equal(f.read(f.daily.feeDay).foundation, "1500000");
  const amount = f.tokenBalance(f.ownerToken);
  await f.send(
    f.call(
      "swap",
      {
        buy: false,
        amount,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 100n,
      },
      [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
    ),
  );
  assert.equal(f.tokenBalance(f.ownerToken), 0n);
});
test("upfront consumes first window; plan approval alone cannot pay; stale evidence cannot approve", async () => {
  const f = await setup();
  await f.adopt();
  assert.equal(f.tokenBalance(f.ownerToken), 210_000_000_000n);
  const ma = await f.propose();
  const pay = () =>
    f.call("pay", {}, [
      f.keys.project,
      ma,
      f.keys.mint,
      f.keys.reserve,
      f.ownerToken,
      TOKEN,
    ]);
  assert.ok(
    (await f.send(pay(), f.owner, true)) instanceof FailedTransactionMetadata,
  );
  f.advance(2 * 86400);
  const sa = await f.submit(ma, f.owner);
  await f.award(ma, sa);
  f.advance(2 * 86400);
  assert.ok(
    (await f.send(pay(), f.owner, true)) instanceof FailedTransactionMetadata,
  );
  f.advance(21 * 86400);
  await f.send(pay());
  assert.equal(f.tokenBalance(f.ownerToken), 310_000_000_000n);
  f.svm.expireBlockhash();
  assert.ok(
    (await f.send(pay(), f.owner, true)) instanceof FailedTransactionMetadata,
  );
});
test("failed milestone preserves allocation and terms, opens community work, and rejects old submissions", async () => {
  const f = await setup();
  await f.adopt();
  const ma = await f.propose();
  f.advance(2 * 86400);
  const old = await f.submit(ma, f.owner);
  await f.send(
    f.call("reopen", { revision: 0n, report: HASH }, [f.keys.project, ma]),
  );
  assert.equal(f.read(ma).community, true);
  assert.equal(f.read(f.keys.project).devCommitted, "0");
  assert.equal(f.read(f.keys.project).workerCommitted, "100000000000");
  assert.ok(
    (await f.send(
      f.call("award", { revision: 1n, evidence: HASH, report: HASH }, [
        f.keys.project,
        ma,
        old,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  f.advance(21 * 86400);
  const sa = await f.submit(ma, f.worker);
  await f.award(ma, sa);
  f.advance(2 * 86400);
  await f.send(
    f.call("pay", {}, [
      f.keys.project,
      ma,
      f.keys.mint,
      f.keys.reserve,
      f.workerToken,
      TOKEN,
    ]),
  );
  assert.equal(f.tokenBalance(f.workerToken), 100_000_000_000n);
});

test("prefunding future program addresses cannot block a launch", async () => {
  const f = await setup({ prefund: true });
  assert.equal(f.tokenBalance(f.keys.pool), 14_700_000_000_000n);
});
test("owner and outsider cannot mint, restore mint authority, or freeze holders", async () => {
  const f = await setup();
  for (const attacker of [f.owner, f.worker])
    for (const ix of [
      getMintToCheckedInstruction({
        mint: f.keys.mint,
        token: f.ownerToken,
        mintAuthority: attacker,
        amount: 1n,
        decimals: 6,
      }),
      getSetAuthorityInstruction({
        owned: f.keys.mint,
        owner: attacker,
        authorityType: 0,
        newAuthority: attacker.address,
      }),
      getFreezeAccountInstruction({
        account: f.ownerToken,
        mint: f.keys.mint,
        owner: attacker,
      }),
    ])
      assert.ok(
        (await f.send(ix, attacker, true)) instanceof FailedTransactionMetadata,
      );
  assert.equal(
    getMintDecoder().decode(f.svm.getAccount(f.keys.mint).data).supply,
    21_000_000_000_000n,
  );
});
test("wrong vault, unauthorized governor, slippage and expired trades roll back", async () => {
  const f = await setup();
  const args = {
    buy: true,
    amount: 1_000_000n,
    minOut: 1n,
    deadline: f.svm.getClock().unixTimestamp + 100n,
  };
  for (const [a, pool] of [
    [{ ...args, minOut: 21_000_000_000_000n }, f.keys.pool],
    [{ ...args, deadline: -1n }, f.keys.pool],
    [args, f.keys.reserve],
  ])
    assert.ok(
      (await f.send(
        f.call("swap", a, [
          f.keys.project,
          f.keys.mint,
          pool,
          f.ownerToken,
          SYSTEM,
          TOKEN,
        ]),
        f.owner,
        true,
      )) instanceof FailedTransactionMetadata,
    );
  assert.equal(f.read(f.keys.project).quoteReserve, "0");
  await f.send(f.call("requestAdoption", { terms: HASH }, [f.keys.project]));
  assert.ok(
    (await f.send(
      f.call(
        "approveAdoption",
        { nonce: 1n, owner: f.owner.address, terms: HASH, report: HASH },
        [f.keys.project],
        f.worker,
      ),
      f.worker,
      true,
    )) instanceof FailedTransactionMetadata,
  );
});
test("SOL sponsorship refunds once and community milestones reject owner claims", async () => {
  const f = await setup();
  await f.adopt();
  const receipt = await pda(
    f.program,
    "sponsor",
    pub(f.keys.project),
    pub(f.worker.address),
    integer(1),
  );
  await f.send(
    f.call(
      "sponsor",
      { amount: 1_000_000_000n, nonce: 1n },
      [f.keys.project, receipt, SYSTEM],
      f.worker,
    ),
    f.worker,
  );
  assert.equal(f.read(f.keys.project).refundable, "1000000000");
  assert.ok(
    (await f.send(
      f.call("settleSponsorship", { refund: false }, [f.keys.project, receipt]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  await f.send(
    f.call(
      "settleSponsorship",
      { refund: true },
      [f.keys.project, receipt],
      f.worker,
    ),
    f.worker,
  );
  f.svm.expireBlockhash();
  assert.ok(
    (await f.send(
      f.call(
        "settleSponsorship",
        { refund: true },
        [f.keys.project, receipt],
        f.worker,
      ),
      f.worker,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  const next = await pda(
    f.program,
    "sponsor",
    pub(f.keys.project),
    pub(f.worker.address),
    integer(2),
  );
  await f.send(
    f.call(
      "sponsor",
      { amount: 1_000_000_000n, nonce: 2n },
      [f.keys.project, next, SYSTEM],
      f.worker,
    ),
    f.worker,
  );
  f.advance(86400);
  await f.send(
    f.call("settleSponsorship", { refund: false }, [f.keys.project, next]),
  );
  assert.equal(f.read(f.keys.project).solAvailable, "1000000000");
  const ma = await f.propose(true, true, 1_000_000_000n);
  f.advance(2 * 86400);
  assert.ok(
    (await f.send(
      f.call("submitWork", { evidence: HASH }, [
        f.keys.project,
        ma,
        await pda(f.program, "work", pub(ma), pub(f.owner.address), integer(0)),
        SYSTEM,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  const sa = await f.submit(ma, f.worker);
  await f.award(ma, sa);
  f.advance(2 * 86400);
  const before = f.svm.getBalance(f.worker.address);
  await f.send(f.call("pay", {}, [f.keys.project, ma, f.worker.address]));
  assert.equal(f.svm.getBalance(f.worker.address) - before, 1_000_000_000n);
  assert.equal(f.read(f.keys.project).solCommitted, "0");
});
test("developer total cap includes upfront and preserves the community minimum", async () => {
  const f = await setup();
  await f.adopt();
  for (let i = 0; i < 19; i++) {
    const ma = await f.propose(false, false, 210_000_000_000n);
    f.advance(21 * 86400);
    const sa = await f.submit(ma, f.owner);
    await f.award(ma, sa);
    f.advance(2 * 86400);
    await f.send(
      f.call("pay", {}, [
        f.keys.project,
        ma,
        f.keys.mint,
        f.keys.reserve,
        f.ownerToken,
        TOKEN,
      ]),
    );
  }
  assert.equal(f.read(f.keys.project).devReleased, "4200000000000");
  assert.equal(f.tokenBalance(f.keys.reserve), 2_100_000_000_000n);
  const id = BigInt(f.read(f.keys.project).milestoneCount) + 1n,
    ma = await pda(f.program, "milestone", pub(f.keys.project), integer(id));
  await f.send(
    f.call(
      "proposeMilestone",
      {
        community: false,
        solReward: false,
        amount: 1n,
        deadline: f.svm.getClock().unixTimestamp + 30n * 86400n,
        terms: HASH,
        uri: "https://github.com/example/oss",
      },
      [f.keys.project, ma, SYSTEM],
    ),
  );
  assert.ok(
    (await f.send(
      f.call("reviewMilestone", { approve: true, terms: HASH, report: HASH }, [
        f.keys.project,
        ma,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
});
test("governor cannot spend quote funds through the retired OTC settlement", async () => {
  const f = await setup();
  await f.send(
    f.call(
      "swap",
      {
        buy: true,
        amount: 1_000_000_000n,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 100n,
      },
      [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
    ),
  );
  const before = f.svm.getBalance(f.fa);
  assert.ok(
    (await f.send(
      f.call("buyBurn", { sol: 20_000_000n, tokens: 1n, report: HASH }, []),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(f.read(f.daily.feeDay).development, "30000000");
  assert.equal(f.svm.getBalance(f.fa), before);
});
test("worker token awards take priority and a challenged award cannot pay", async () => {
  const f = await setup();
  await f.adopt();
  const dev = await f.propose(false, false, 100_000_000_000n),
    work = await f.propose(true, false, 100_000_000_000n);
  f.advance(21 * 86400);
  await f.award(dev, await f.submit(dev, f.owner));
  await f.award(work, await f.submit(work, f.worker));
  await f.send(
    f.call("challenge", { reason: HASH }, [f.keys.project, work], f.worker),
    f.worker,
  );
  f.advance(2 * 86400);
  assert.ok(
    (await f.send(
      f.call("pay", {}, [
        f.keys.project,
        work,
        f.keys.mint,
        f.keys.reserve,
        f.workerToken,
        TOKEN,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.ok(
    (await f.send(
      f.call("pay", {}, [
        f.keys.project,
        dev,
        f.keys.mint,
        f.keys.reserve,
        f.ownerToken,
        TOKEN,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  await f.send(
    f.call("resolve", { revision: 0n, uphold: true, report: HASH }, [
      f.keys.project,
      work,
    ]),
  );
  assert.ok(
    (await f.send(
      f.call("challenge", { reason: HASH }, [f.keys.project, work], f.worker),
      f.worker,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  f.advance(2 * 86400);
  await f.send(
    f.call("pay", {}, [
      f.keys.project,
      work,
      f.keys.mint,
      f.keys.reserve,
      f.workerToken,
      TOKEN,
    ]),
  );
  await f.send(
    f.call("pay", {}, [
      f.keys.project,
      dev,
      f.keys.mint,
      f.keys.reserve,
      f.ownerToken,
      TOKEN,
    ]),
  );
});
test("tokenless repository adoption pays no upfront SOL; OSS fees cannot be withdrawn to a wallet", async () => {
  const f = await setup(),
    source = "https://github.com/example/tokenless",
    project = await pda(f.program, "project", await sha256(source));
  await f.send(
    f.call("registerFund", { name: "Tokenless OSS", source }, [
      project,
      SYSTEM,
    ]),
  );
  await f.send(f.call("requestAdoption", { terms: HASH }, [project]));
  await f.send(
    f.call(
      "approveAdoption",
      { nonce: 1n, owner: f.owner.address, terms: HASH, report: HASH },
      [project],
    ),
  );
  f.advance(2 * 86400);
  await f.send(f.call("finalizeAdoption", {}, [project]));
  assert.equal(f.read(project).tokenless, true);
  assert.equal(f.read(project).devReleased, "0");
  await f.initDay();
  await f.send(
    f.call(
      "swap",
      {
        buy: true,
        amount: 1_000_000_000n,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 100n,
      },
      [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
    ),
  );
  const marker = await pda(f.program, "oss", HASH);
  assert.ok(
    (await f.send(
      f.call("fundOss", { amount: 50_000_000n, evidence: HASH }, [
        f.worker.address,
        marker,
        SYSTEM,
      ]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(f.read(f.daily.feeDay).community, "5000000");
  assert.equal(f.read(f.daily.feeDay).governance, "13500000");
  assert.equal(f.read(f.daily.feeDay).foundation, "1500000");
});
test("repeated trades conserve real balances and never decrease the curve product", async () => {
  const f = await setup();
  let seed = 17n;
  for (let i = 0; i < 60; i++) {
    seed = (seed * 48271n) % 2147483647n;
    const balance = f.tokenBalance(f.ownerToken),
      buy = i % 3 !== 2 || balance === 0n,
      amount = buy ? 10000n + (seed % 100_000_000n) : balance / 2n;
    const before = f.read(f.keys.project),
      k =
        BigInt(before.tokenReserve) *
        (BigInt(before.virtualQuote) + BigInt(before.quoteReserve));
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
    const after = f.read(f.keys.project),
      factory = f.read(f.daily.feeDay);
    assert.ok(
      BigInt(after.tokenReserve) *
        (BigInt(after.virtualQuote) + BigInt(after.quoteReserve)) >=
        k,
    );
    assert.equal(f.tokenBalance(f.keys.pool), BigInt(after.tokenReserve));
    assert.equal(f.tokenBalance(f.keys.quotePool), BigInt(after.quoteReserve));
    assert.equal(f.tokenBalance(f.daily.feeVault), BigInt(factory.fees));
  }
});

test("replacing an adoption request invalidates an old approval nonce", async () => {
  const f = await setup();
  await f.send(f.call("requestAdoption", { terms: HASH }, [f.keys.project]));
  await f.send(f.call("rejectAdoption", { report: HASH }, [f.keys.project]));
  f.svm.expireBlockhash();
  await f.send(f.call("requestAdoption", { terms: HASH }, [f.keys.project]));
  assert.equal(f.read(f.keys.project).adoptionNonce, "2");
  assert.ok(
    (await f.send(
      f.call(
        "approveAdoption",
        { nonce: 1n, owner: f.owner.address, terms: HASH, report: HASH },
        [f.keys.project],
      ),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  await f.send(
    f.call(
      "approveAdoption",
      { nonce: 2n, owner: f.owner.address, terms: HASH, report: HASH },
      [f.keys.project],
    ),
  );
});

test("repo owner earns SOL payroll through delivery review; failed payroll becomes community work", async () => {
  const f = await setup();
  await f.adopt();
  const receipt = await pda(
    f.program,
    "sponsor",
    pub(f.keys.project),
    pub(f.worker.address),
    integer(3),
  );
  await f.send(
    f.call(
      "sponsor",
      { amount: 1_000_000_000n, nonce: 3n },
      [f.keys.project, receipt, SYSTEM],
      f.worker,
    ),
    f.worker,
  );
  f.advance(86400);
  await f.send(
    f.call("settleSponsorship", { refund: false }, [f.keys.project, receipt]),
  );
  const ma = await f.propose(false, true, 400_000_000n);
  f.advance(2 * 86400);
  assert.ok(
    (await f.send(
      f.call("pay", {}, [f.keys.project, ma, f.owner.address]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  const sa = await f.submit(ma, f.owner);
  await f.award(ma, sa);
  f.advance(2 * 86400);
  const before = f.svm.getBalance(f.owner.address);
  await f.send(
    f.call("pay", {}, [f.keys.project, ma, f.owner.address], f.worker),
    f.worker,
  );
  assert.equal(f.svm.getBalance(f.owner.address) - before, 400_000_000n);
  assert.equal(f.read(f.keys.project).devReleased, "210000000000");
  const failed = await f.propose(false, true, 600_000_000n);
  await f.send(
    f.call("reopen", { revision: 0n, report: HASH }, [f.keys.project, failed]),
  );
  assert.equal(f.read(failed).community, true);
  assert.equal(f.read(f.keys.project).solCommitted, "600000000");
  assert.equal(f.read(f.keys.project).devCommitted, "0");
  assert.equal(f.read(f.keys.project).workerCommitted, "0");
  f.advance(2 * 86400);
  const submission = await f.submit(failed, f.worker);
  await f.award(failed, submission);
  f.advance(2 * 86400);
  await f.send(f.call("pay", {}, [f.keys.project, failed, f.worker.address]));
  assert.equal(f.read(f.keys.project).solCommitted, "0");
});

test("small trades keep rounding dust unspendable until each destination earns it", async () => {
  const f = await setup();
  for (let i = 0; i < 100; i++) {
    await f.send(
      f.call(
        "swap",
        {
          buy: true,
          amount: 10n,
          minOut: 1n,
          deadline: f.svm.getClock().unixTimestamp + 100n + BigInt(i),
        },
        [f.keys.project, f.keys.mint, f.keys.pool, f.ownerToken, SYSTEM, TOKEN],
      ),
    );
    const a = f.read(f.daily.feeDay),
      total = BigInt(a.fees);
    for (const [key, weight] of [
      ["development", 60n],
      ["governance", 27n],
      ["community", 10n],
      ["foundation", 3n],
    ])
      assert.equal(BigInt(a[key]), (total * weight) / 100n);
  }
  assert.equal(f.read(f.daily.feeDay).fees, "100");
});

test("documented open risk: an unverified pending adopter blocks another request until rejection", async () => {
  const f = await setup();
  await f.send(
    f.call("requestAdoption", { terms: HASH }, [f.keys.project], f.worker),
    f.worker,
  );
  assert.equal(f.read(f.keys.project).owner, f.worker.address);
  assert.ok(
    (await f.send(
      f.call("requestAdoption", { terms: HASH }, [f.keys.project]),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(f.read(f.keys.project).adopted, false);
  await f.send(f.call("rejectAdoption", { report: HASH }, [f.keys.project]));
  await f.send(
    f.call("requestAdoption", { terms: "02".repeat(32) }, [f.keys.project]),
  );
  assert.equal(f.read(f.keys.project).owner, f.owner.address);
});

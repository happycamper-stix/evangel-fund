import {
  collectVenueInstruction,
  launchVenueInstruction,
} from "../../lib/solana/venue-client.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  getMintDecoder,
  getTokenDecoder,
  getTransferCheckedInstruction,
} from "@solana-program/token-2022";
import { FailedTransactionMetadata } from "litesvm";
import { allocateVenueReceipts } from "../../lib/solana/fee-policy.mjs";
import { setup } from "../support/solana-fixture.mjs";
import {
  TOKEN,
  sha256,
  concat,
  integer,
  pda,
} from "../../lib/solana/program.mjs";
for (const venueCluster of ["mainnet-beta", "devnet"])
  for (const metadata of [false, true])
    test(`${venueCluster} metadata=${metadata}: candidate custody atomically initializes and locks venue liquidity, preserves reserve, and collects only venue receipts`, async () => {
      const f = await setup({ venue: true, metadata, venueCluster });
      const mint = getMintDecoder().decode(f.svm.getAccount(f.keys.mint).data);
      assert.equal(mint.supply, 21_000_000_000_000n);
      assert.equal(mint.mintAuthority.__option, "None");
      assert.equal(mint.freezeAuthority.__option, "None");
      assert.equal(f.tokenBalance(f.keys.reserve), 6_300_000_000_000n);
      assert.equal(f.tokenBalance(f.keys.pool), 0n);
      assert.equal(f.tokenBalance(f.sponsorQuote), 99n);
      for (const key of [f.keys.pool, f.keys.quotePool])
        assert.equal(
          getTokenDecoder().decode(f.svm.getAccount(key).data).delegate
            .__option,
          "None",
        );
      const collect = () =>
        f.call("collectVenue", {}, [
          f.keys.project,
          f.keys.mint,
          f.keys.pool,
          f.quoteMint,
          f.keys.quotePool,
          f.daily.feeDay,
          f.daily.feeVault,
          TOKEN,
          ...f.venueAccounts,
        ]);
      await f.send(collect());
      assert.equal(f.read(f.daily.feeDay).fees, "0");
      const [
        venue,
        authority,
        pool,
        ,
        ,
        nftAccount,
        baseVault,
        quoteVault,
        event,
      ] = f.venueAccounts;
      const meta = (address, role = 0, signer) => ({
        address,
        role,
        ...(signer ? { signer } : {}),
      });
      async function swap(buy, amount) {
        const input = buy ? f.quoteToken : f.ownerToken,
          output = buy ? f.ownerToken : f.quoteToken;
        await f.send({
          programAddress: venue,
          data: concat([
            (await sha256("global:swap")).slice(0, 8),
            integer(amount),
            integer(1n),
          ]),
          accounts: [
            meta(authority),
            meta(pool, 1),
            meta(input, 1),
            meta(output, 1),
            meta(baseVault, 1),
            meta(quoteVault, 1),
            meta(f.keys.mint),
            meta(f.quoteMint),
            meta(f.owner.address, 2, f.owner),
            meta(TOKEN),
            meta(TOKEN),
            meta(venue),
            meta(event),
            meta(venue),
          ],
        });
      }
      await swap(true, 1_000_000_000n);
      assert.ok(f.tokenBalance(f.ownerToken) > 0n);
      const protocol = () =>
        new DataView(f.svm.getAccount(pool).data.buffer).getBigUint64(
          400,
          true,
        );
      assert.equal(protocol(), 10_000_000n); // 20% of the 5% buy fee.
      f.svm.expireBlockhash();
      await f.send(collect());
      let daily = f.read(f.daily.feeDay),
        received = BigInt(daily.fees);
      assert.ok(received >= 39_999_999n && received <= 40_000_000n);
      for (const [key, value] of Object.entries(
        allocateVenueReceipts(received),
      ))
        if (key !== "dust") assert.equal(daily[key], String(value));
      assert.equal(f.tokenBalance(f.daily.feeVault), received);
      f.svm.expireBlockhash();
      await f.send(collect());
      assert.equal(f.read(f.daily.feeDay).fees, String(received)); // No double credit.
      // An unsolicited transfer is not a fee receipt.
      await f.send(
        getTransferCheckedInstruction({
          source: f.quoteToken,
          mint: f.quoteMint,
          destination: f.keys.quotePool,
          authority: f.owner,
          amount: 123n,
          decimals: 6,
        }),
      );
      f.svm.expireBlockhash();
      await f.send(collect());
      assert.equal(f.read(f.daily.feeDay).fees, String(received));
      const beforeSellQuote = f.tokenBalance(f.quoteToken),
        beforeSellProtocol = protocol();
      const lpFees = () => {
        const bytes = f.svm.getAccount(pool).data;
        const v = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        return v.getBigUint64(584, true) + (v.getBigUint64(592, true) << 64n);
      };
      const beforeSellLp = lpFees();
      await swap(false, f.tokenBalance(f.ownerToken) / 2n);
      const sellFee = protocol() - beforeSellProtocol + lpFees() - beforeSellLp;
      const grossSellQuote =
        f.tokenBalance(f.quoteToken) - beforeSellQuote + sellFee;
      assert.equal(sellFee, (grossSellQuote + 19n) / 20n);
      assert.equal(protocol() - beforeSellProtocol, sellFee / 5n);
      assert.ok(protocol() > 10_000_000n);
      // Approved but unpaid inference commitments survive the daily surplus sweep.
      const invoice = await sha256("candidate invoice"),
        report = await sha256("candidate expense review");
      const receipt = await pda(f.program, "quote-expense", invoice);
      await f.send(
        f.call(
          "approveQuoteExpense",
          { day: f.daily.day, amount: 1000n, invoice, report },
          [
            f.keys.project,
            f.daily.feeDay,
            receipt,
            "11111111111111111111111111111111",
          ],
        ),
      );
      f.advance(86400);
      const old = f.daily;
      // A stale FeeDay cannot receive today's collection.
      assert.ok(
        (await f.send(collect(), f.owner, true)) instanceof
          FailedTransactionMetadata,
      );
      await f.initDay();
      await f.send(collect());
      assert.ok(BigInt(f.read(f.daily.feeDay).fees) > 0n);
      assert.equal(f.read(old.feeDay).fees, String(received));
      await f.send(
        f.call("settleFeeDay", { day: old.day }, [f.keys.project, old.feeDay]),
      );
      const settled = f.read(old.feeDay),
        expected = allocateVenueReceipts(received);
      assert.equal(
        settled.development,
        String(
          expected.development + expected.governance + expected.dust - 1000n,
        ),
      );
      assert.equal(settled.governance, "0");
      assert.equal(settled.expenseCommitted, "1000");
      assert.equal(f.tokenBalance(f.keys.reserve), 6_300_000_000_000n);
      assert.equal(f.tokenBalance(f.keys.quotePool), 123n);
    });

test("candidate rejects account substitution, mutable configuration, unlocked positions and venue upgrades", async () => {
  const f = await setup({ venue: true, metadata: true });
  const args = [
    f.keys.project,
    f.keys.mint,
    f.keys.pool,
    f.quoteMint,
    f.keys.quotePool,
    f.daily.feeDay,
    f.daily.feeVault,
    TOKEN,
    ...f.venueAccounts,
  ];
  const collect = () => f.call("collectVenue", {}, args);
  for (const index of [
    1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  ]) {
    const wrong = [...args];
    wrong[index] = f.ownerToken;
    f.svm.expireBlockhash();
    assert.ok(
      (await f.send(
        f.call("collectVenue", {}, wrong),
        f.owner,
        true,
      )) instanceof FailedTransactionMetadata,
      `account ${index}`,
    );
  }
  // Fault injection models a venue update or corrupted state, not a user write.
  for (const [address, offset] of [
    [f.venueAccounts[2], 8],
    [f.venueAccounts[2], 48],
    [f.venueAccounts[2], 56],
    [f.venueAccounts[2], 484],
    [f.venueAccounts[2], 296],
    [f.venueAccounts[2], 648],
    [f.venueAccounts[5], 72],
    [f.venueAccounts[5], 129],
    [f.venueAccounts[3], 152],
    [f.venueAccounts[3], 392],
    [f.venueAccounts[9], 4],
    [f.quoteMint, 170],
    [f.quoteMint, 166],
    [f.quoteMint, 44],
    [f.quoteMint, 46],
  ]) {
    const original = f.svm.getAccount(address),
      data = new Uint8Array(original.data);
    data[offset] ^= 1;
    f.svm.setAccount({ ...original, data });
    f.svm.expireBlockhash();
    assert.ok(
      (await f.send(collect(), f.owner, true)) instanceof
        FailedTransactionMetadata,
      `mutated ${address}:${offset}`,
    );
    f.svm.setAccount(original);
  }
  assert.equal(f.read(f.daily.feeDay).fees, "0");
  assert.equal(f.tokenBalance(f.keys.reserve), 6_300_000_000_000n);
});

test("a one-token-unit short launch rolls back mint, reserve, pool and sponsor transfer", async () => {
  const f = await setup({ venue: true, underfund: true });
  assert.ok(f.launchResult instanceof FailedTransactionMetadata);
  for (const key of [
    f.keys.project,
    f.keys.mint,
    f.keys.pool,
    f.keys.reserve,
    f.keys.quotePool,
  ])
    assert.equal(f.svm.getAccount(key).exists, false);
  assert.equal(
    getTokenDecoder().decode(f.svm.getAccount(f.quoteToken).data).amount,
    999_999_999_900n,
  );
  assert.equal(
    getTokenDecoder().decode(f.svm.getAccount(f.sponsorQuote).data).amount,
    100n,
  );
});

test("review build requires real Squads governance and keeps legacy trading disabled", async () => {
  await assert.rejects(
    setup({ venue: true, venueRelease: true }),
    /InvalidArgument/,
  );
  const f = await setup({
    venue: true,
    venueRelease: true,
    quorum: true,
    venueCluster: "devnet",
  });
  assert.notEqual(f.governanceMultisig, "11111111111111111111111111111111");
  await f.send(
    f.call("collectVenue", {}, [
      f.keys.project,
      f.keys.mint,
      f.keys.pool,
      f.quoteMint,
      f.keys.quotePool,
      f.daily.feeDay,
      f.daily.feeVault,
      TOKEN,
      ...f.venueAccounts,
    ]),
  );
  assert.ok(
    (await f.send(
      f.call(
        "swap",
        {
          buy: true,
          amount: 1n,
          minOut: 1n,
          deadline: f.svm.getClock().unixTimestamp + 60n,
        },
        [
          f.keys.project,
          f.keys.mint,
          f.keys.pool,
          f.ownerToken,
          "11111111111111111111111111111111",
          TOKEN,
        ],
      ),
      f.owner,
      true,
    )) instanceof FailedTransactionMetadata,
  );
  assert.equal(f.tokenBalance(f.keys.reserve), 6_300_000_000_000n);
});

test("collection builder produces the same canonical custody instruction with readonly deployment accounts", async () => {
  const f = await setup({ venue: true });
  const ix = await collectVenueInstruction({
    program: f.program,
    caller: f.owner,
    project: f.keys.project,
    mint: f.keys.mint,
    quoteMint: f.quoteMint,
    day: f.daily.day,
  });
  await f.send(ix);
  assert.equal(
    ix.accounts.find((a) => a.address === f.venueAccounts[9]).role,
    0,
  );
  assert.equal(f.read(f.daily.feeDay).fees, "0");
});

test("launch builder supports a distinct sponsor without delegating reserve or position custody", async () => {
  const f = await setup({ venue: true });
  const built = await launchVenueInstruction({
    program: f.program,
    creator: f.owner,
    count: 1n,
    quoteMint: f.quoteMint,
    sponsor: f.worker,
    sponsorQuote: f.sponsorQuote,
    name: "Second project",
    symbol: "SECOND",
    source: "https://github.com/example/second",
    sqrtMin: 1n << 64n,
    sqrtMax: 2n << 64n,
  });
  await f.send(built.instruction);
  assert.equal(f.tokenBalance(built.keys.reserve), 6_300_000_000_000n);
  assert.equal(f.tokenBalance(built.keys.pool), 0n);
  assert.equal(f.tokenBalance(f.sponsorQuote), 98n);
  assert.equal(
    getTokenDecoder().decode(f.svm.getAccount(built.keys.reserve).data).delegate
      .__option,
    "None",
  );
});

test("venue reserve retains the existing upfront grant and shared release limit", async () => {
  const f = await setup({ venue: true });
  await f.adopt();
  assert.equal(f.tokenBalance(f.ownerToken), 210_000_000_000n);
  assert.equal(f.tokenBalance(f.keys.reserve), 6_090_000_000_000n);
  const milestone = await f.propose();
  f.advance(2 * 86400);
  const submission = await f.submit(milestone, f.owner);
  await f.award(milestone, submission);
  f.advance(2 * 86400);
  const pay = () =>
    f.call("pay", {}, [
      f.keys.project,
      milestone,
      f.keys.mint,
      f.keys.reserve,
      f.ownerToken,
      TOKEN,
    ]);
  assert.ok(
    (await f.send(pay(), f.owner, true)) instanceof FailedTransactionMetadata,
  );
  f.advance(21 * 86400);
  await f.send(pay());
  assert.equal(f.tokenBalance(f.ownerToken), 310_000_000_000n);
});

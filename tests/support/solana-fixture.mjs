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
  getInitializeMetadataPointerInstruction,
  getInitializeTokenMetadataInstruction,
  getUpdateTokenMetadataUpdateAuthorityInstruction,
  getInitializeAccount3Instruction,
  getTokenDecoder,
  getMintDecoder,
  getMintToCheckedInstruction,
  getTransferCheckedInstruction,
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
export async function setup({
  prefund = false,
  quorum = false,
  venue = false,
  metadata = false,
  underfund = false,
  venueCluster = "mainnet-beta",
  venueRelease = false,
} = {}) {
  const svm = new LiteSVM(),
    owner = await generateKeyPairSigner(),
    worker = await generateKeyPairSigner(),
    program = (await generateKeyPairSigner()).address;
  svm.airdrop(owner.address, 100_000_000_000n);
  svm.airdrop(worker.address, 10_000_000_000n);
  svm.addProgram(
    program,
    new Uint8Array(
      await readFile(
        venueRelease
          ? ".evangel/venue-release/evangel_factory.so"
          : venue
            ? ".evangel/venue-programs/evangel_factory.so"
            : ".evangel/test-programs/evangel_factory.so",
      ),
    ),
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
      [
        ...(venue
          ? [
              {
                programAddress: "ComputeBudget111111111111111111111111111111",
                data: Uint8Array.of(2, 128, 26, 6, 0),
                accounts: [],
              },
            ]
          : []),
        ...(Array.isArray(ix) ? ix : [ix]),
      ],
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
    return instruction(
      program,
      name,
      args,
      [who.address, fa, ...acc],
      [who, ...(name === "launchVenue" ? [worker] : [])],
    );
  };
  await send([
    getCreateAccountInstruction({
      payer: owner,
      newAccount: quoteSigner,
      lamports: svm.minimumBalanceForRentExemption(metadata ? 1024n : 82n),
      space: metadata ? 234n : 82n,
      programAddress: TOKEN,
    }),
    ...(metadata
      ? [
          getInitializeMetadataPointerInstruction({
            mint: quoteMint,
            authority: null,
            metadataAddress: quoteMint,
          }),
        ]
      : []),
    getInitializeMint2Instruction({
      mint: quoteMint,
      decimals: 6,
      mintAuthority: owner.address,
      freezeAuthority: null,
    }),
  ]);
  if (metadata)
    await send([
      getInitializeTokenMetadataInstruction({
        metadata: quoteMint,
        updateAuthority: owner.address,
        mint: quoteMint,
        mintAuthority: owner,
        name: "Quote fixture",
        symbol: "QUOTE",
        uri: "https://example.com/quote",
      }),
      getUpdateTokenMetadataUpdateAuthorityInstruction({
        metadata: quoteMint,
        updateAuthority: owner,
        newUpdateAuthority: null,
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
  let venueAccounts = [],
    venuePlan,
    sponsorQuote;
  if (venue) {
    sponsorQuote = await makeToken(worker, quoteMint);
    await send(
      getTransferCheckedInstruction({
        source: quoteToken,
        mint: quoteMint,
        destination: sponsorQuote,
        authority: owner,
        amount: 100n,
        decimals: 6,
      }),
    );
    const { DAMM_V2 } = await import("../../lib/solana/venue-policy.mjs");
    const { planOneSidedLaunch, venueAddresses } =
      await import("../../lib/solana/damm-plan.mjs");
    const { createHash } = await import("node:crypto");
    const observed = JSON.parse(
      await readFile(
        venueCluster === "devnet"
          ? "docs/DAMM_DEVNET_INSPECTION.json"
          : "docs/DAMM_VENUE_INSPECTION.json",
        "utf8",
      ),
    );
    const hash = observed.binarySha256;
    const binary = await readFile(`.evangel/references/damm-v2-${hash}.so`);
    assert.equal(createHash("sha256").update(binary).digest("hex"), hash);
    svm.addProgram(DAMM_V2.program, new Uint8Array(binary));
    // Match observed deployment metadata; executable bytes are hash-checked above.
    const venueData = await pda(LOADER, pub(DAMM_V2.program));
    const va = svm.getAccount(venueData),
      vd = new Uint8Array(va.data);
    new DataView(vd.buffer).setBigUint64(
      4,
      BigInt(observed.deployedSlot),
      true,
    );
    vd[12] = 1;
    vd.set(pub(observed.upgradeAuthority), 13);
    svm.setAccount({ ...va, data: vd });
    const nft = await pda(program, "venue-nft", pub(keys.project));
    const a = await venueAddresses(keys.mint, quoteMint, nft);
    venueAccounts = [
      DAMM_V2.program,
      a.poolAuthority,
      a.pool,
      a.position,
      nft,
      a.positionNftAccount,
      a.baseVault,
      a.quoteVault,
      a.eventAuthority,
      venueData,
    ];
    venuePlan = planOneSidedLaunch({ sqrtMin: 1n << 64n, sqrtMax: 2n << 64n });
  }
  const launchResult = await send(
    call(
      venue ? "launchVenue" : "launch",
      {
        name: "OSS work",
        symbol: "WORK",
        source: "https://github.com/example/oss",
        virtualQuote: 1_000_000_000n,
        ...(venue
          ? {
              ...venuePlan,
              liquidity: venuePlan.liquidity - (underfund ? 2n << 64n : 0n),
            }
          : {}),
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
        ...(venue ? [worker.address, sponsorQuote, ...venueAccounts] : []),
      ],
    ),
    owner,
    underfund,
  );
  if (underfund)
    return { svm, keys, launchResult, fa, quoteToken, sponsorQuote };
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
    venueAccounts,
    sponsorQuote,
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

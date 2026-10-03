import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  daoComputeBudget,
  daoInstruction,
  daoAddress,
  daoAuthority,
  daoProposal,
  daoStake,
  daoEscrow,
  daoBallot,
  decodeDao,
} from "../../lib/solana/dao.mjs";
import { TOKEN, LOADER, SYSTEM, pub, pda } from "../../lib/solana/program.mjs";
const DAY = 86400n,
  SUPPLY = 21_000_000_000_000n;
const key = async () => (await generateKeyPairSigner()).address;
const ro = (address) => ({ address, role: 0 }),
  rw = (address) => ({ address, role: 1 }),
  sign = (s) => ({ address: s.address, role: 3, signer: s });
async function setup(options = {}) {
  const svm = new LiteSVM(),
    admin = await generateKeyPairSigner(),
    developer = await generateKeyPairSigner(),
    voter = await generateKeyPairSigner(),
    outsider = await generateKeyPairSigner();
  const reviewers = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  reviewers.sort((a, b) =>
    Buffer.compare(Buffer.from(pub(a.address)), Buffer.from(pub(b.address))),
  );
  for (const s of [admin, developer, voter, outsider, ...reviewers])
    svm.airdrop(s.address, 100_000_000_000n);
  const program = await key(),
    target = await key(),
    mint = await key();
  const code = await readFile(".evangel/test-programs/evangel_factory.so");
  svm.addProgram(target, code);
  svm.addProgram(
    program,
    await readFile(".evangel/dao-programs/evangel_dao.so"),
  );
  const pd = await pda(LOADER, pub(target)),
    guardData = await pda(LOADER, pub(program));
  function authority(address, value) {
    const a = svm.getAccount(address),
      d = Buffer.from(a.data);
    d[12] = value ? 1 : 0;
    if (value) d.set(pub(value), 13);
    svm.setAccount({ ...a, data: d });
  }
  authority(pd, admin.address);
  authority(guardData, options.mutableGuard ? admin.address : null);
  function raw(address, owner, data) {
    svm.airdrop(address, 10_000_000_000n);
    svm.setAccount({ ...svm.getAccount(address), programAddress: owner, data });
  }
  const md = Buffer.alloc(82);
  md.writeBigUInt64LE(SUPPLY, 36);
  md[44] = 6;
  md[45] = 1;
  if (options.mintAuthority) {
    md.writeUInt32LE(1, 0);
    md.set(pub(admin.address), 4);
  }
  if (options.freezeAuthority) {
    md.writeUInt32LE(1, 46);
    md.set(pub(admin.address), 50);
  }
  raw(mint, TOKEN, md);
  const config = await daoAddress(program, target),
    vault = await daoAuthority(program, config);
  function ix(name, args, rest = [], who = developer) {
    return daoInstruction(program, name, args, [
      sign(who),
      rw(config),
      ...rest,
    ]);
  }
  async function send(instruction, who = developer, fail = false) {
    svm.expireBlockhash();
    let msg = setTransactionMessageFeePayerSigner(
      who,
      createTransactionMessage({ version: 0 }),
    );
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstructions(
      [daoComputeBudget(), instruction],
      msg,
    );
    const result = svm.sendTransaction(
      await signTransactionMessageWithSigners(msg),
    );
    if (fail)
      assert.ok(
        result instanceof FailedTransactionMetadata,
        "expected rejection",
      );
    else
      assert.ok(
        !(result instanceof FailedTransactionMetadata),
        result instanceof FailedTransactionMetadata
          ? result.meta().logs().join("\n")
          : "",
      );
    return result;
  }
  const init = () =>
    ix(
      "initialize",
      {
        developer: developer.address,
        reviewers: reviewers.map((x) => x.address),
        treasury: admin.address,
      },
      [ro(target), ro(pd), ro(mint), ro(SYSTEM), ro(guardData)],
      admin,
    );
  await send(init(), admin, !!options.invalid);
  if (options.invalid) return {};
  function advance(seconds) {
    const c = svm.getClock();
    c.unixTimestamp += seconds;
    c.slot += 1n;
    svm.setClock(c);
    svm.expireBlockhash();
  }
  function state(address) {
    return decodeDao(svm.getAccount(address).data);
  }
  async function deposit(amount = SUPPLY / 10n, who = voter) {
    const source = await key(),
      stake = await daoStake(program, config, who.address),
      escrow = await daoEscrow(program, config, who.address);
    const td = Buffer.alloc(165);
    td.set(pub(mint));
    td.set(pub(who.address), 32);
    td.writeBigUInt64LE(amount, 64);
    td[108] = 1;
    raw(source, TOKEN, td);
    const accounts = [
      rw(stake),
      rw(escrow),
      rw(source),
      ro(mint),
      ro(TOKEN),
      ro(SYSTEM),
    ];
    await send(ix("deposit", { amount }, accounts, who), who);
    const withdraw = () =>
      ix(
        "withdraw",
        {},
        [rw(stake), rw(escrow), rw(source), ro(mint), ro(TOKEN)],
        who,
      );
    return { stake, escrow, source, who, withdraw };
  }
  async function propose() {
    const nonce = BigInt(state(config).nonce),
      proposal = await daoProposal(program, config, nonce),
      buffer = await key();
    const bd = Buffer.alloc(37 + code.length);
    bd.writeUInt32LE(1);
    bd[4] = 1;
    bd.set(pub(vault), 5);
    bd.set(code, 37);
    raw(buffer, LOADER, bd);
    const args = {
      code: createHash("sha256").update(code).digest("hex"),
      review: "11".repeat(32),
      uri: "https://example.org/review/immutable-commit",
    };
    const accounts = [rw(proposal), ro(buffer), ro(vault), ro(SYSTEM), ro(pd)];
    await send(ix("propose", args, accounts));
    return { proposal, buffer, args, accounts };
  }
  async function attest(p, r) {
    return send(ix("attest", {}, [rw(p.proposal)], r), r);
  }
  async function reviewed() {
    const p = await propose();
    await attest(p, reviewers[0]);
    await attest(p, reviewers[1]);
    return p;
  }
  async function ballot(p, s, name, args = {}, fail = false) {
    const b = await daoBallot(program, p.proposal, s.who.address);
    return send(
      ix(name, args, [rw(p.proposal), rw(s.stake), rw(b), ro(SYSTEM)], s.who),
      s.who,
      fail,
    );
  }
  const finalize = (p) => send(ix("finalize", {}, [rw(p.proposal)]));
  const execute = (p) =>
    ix("execute", {}, [
      rw(p.proposal),
      rw(target),
      rw(pd),
      rw(p.buffer),
      rw(admin.address),
      ro("SysvarRent111111111111111111111111111111111"),
      ro("SysvarC1ock11111111111111111111111111111111"),
      ro(vault),
      ro(LOADER),
    ]);
  return {
    svm,
    admin,
    developer,
    voter,
    outsider,
    reviewers,
    program,
    target,
    mint,
    pd,
    guardData,
    config,
    vault,
    ix,
    send,
    init,
    advance,
    state,
    deposit,
    propose,
    attest,
    reviewed,
    ballot,
    finalize,
    execute,
    authority,
    raw,
  };
}
test("review gate, 24h exact boundary, actual loader upgrade and replay rejection", async () => {
  const f = await setup(),
    p = await f.propose();
  await f.send(
    f.ix("propose", p.args, p.accounts, f.outsider),
    f.outsider,
    true,
  );
  await f.send(
    f.ix("attest", {}, [rw(p.proposal)], f.outsider),
    f.outsider,
    true,
  );
  await f.attest(p, f.reviewers[0]);
  assert.equal(f.state(p.proposal).status, 0);
  await f.send(
    f.ix("attest", {}, [rw(p.proposal)], f.reviewers[0]),
    f.reviewers[0],
    true,
  );
  await f.attest(p, f.reviewers[1]);
  assert.equal(f.state(p.proposal).status, 1);
  f.advance(DAY - 1n);
  await f.send(f.ix("finalize", {}, [rw(p.proposal)]), f.developer, true);
  f.advance(1n);
  await f.finalize(p);
  assert.equal(f.state(p.proposal).status, 2);
  // Model the separately approved authority migration. No live authority is changed by tests.
  f.authority(f.pd, f.vault);
  await f.send(f.execute(p));
  assert.equal(f.state(p.proposal).status, 4);
  await f.send(f.execute(p), f.developer, true);
});
test("escrow maturity, duplicate challenges, locked withdrawal and no-quorum rejection", async () => {
  const f = await setup(),
    s = await f.deposit(SUPPLY / 100n),
    early = await f.reviewed();
  await f.ballot(early, s, "challenge", { evidence: "22".repeat(32) }, true);
  f.advance(7n * DAY);
  const p = await f.reviewed();
  await f.ballot(p, s, "challenge", { evidence: "22".repeat(32) });
  await f.ballot(p, s, "challenge", { evidence: "22".repeat(32) }, true);
  await f.send(s.withdraw(), s.who, true);
  f.advance(DAY);
  await f.send(f.ix("finalize", {}, [rw(p.proposal)]), f.developer, true);
  await f.ballot(p, s, "vote", { approve: false });
  await f.ballot(p, s, "vote", { approve: true }, true);
  f.advance(3n * DAY);
  await f.finalize(p);
  assert.equal(f.state(p.proposal).status, 3);
  await f.send(f.execute(p), f.developer, true);
  await f.send(s.withdraw(), s.who);
  assert.equal(f.state(s.stake).amount, "0");
});
test("challenged upgrade requires affirmative quorum; wrong buffer and code are rejected", async () => {
  const f = await setup(),
    s = await f.deposit();
  f.advance(7n * DAY);
  const p = await f.reviewed();
  await f.ballot(p, s, "challenge", { evidence: "33".repeat(32) });
  f.advance(DAY);
  await f.ballot(p, s, "vote", { approve: true });
  f.advance(3n * DAY);
  await f.finalize(p);
  assert.equal(f.state(p.proposal).status, 2);
  f.authority(f.pd, f.vault);
  const original = f.svm.getAccount(p.buffer),
    data = Buffer.from(original.data);
  data[data.length - 1] ^= 1;
  f.svm.setAccount({ ...original, data });
  await f.send(f.execute(p), f.developer, true);
  assert.equal(f.state(p.proposal).status, 2);
  f.svm.setAccount(original);
  await f.send(f.execute(p));
});
test("cannot vote with another wallet stake or a canceled proposal; expiry prevents execution", async () => {
  const f = await setup(),
    s = await f.deposit();
  f.advance(7n * DAY);
  const p = await f.reviewed();
  await f.ballot(
    p,
    { ...s, who: f.outsider },
    "challenge",
    { evidence: "33".repeat(32) },
    true,
  );
  await f.send(f.ix("cancel", {}, [rw(p.proposal)]));
  await f.ballot(p, s, "challenge", { evidence: "33".repeat(32) }, true);
  const q = await f.reviewed();
  f.advance(DAY);
  await f.finalize(q);
  f.advance(10n * DAY);
  await f.send(f.execute(q), f.developer, true);
});

test("mutable guard, mint authority, and freeze authority cannot initialize a DAO", async () => {
  for (const invalid of ["mutableGuard", "mintAuthority", "freezeAuthority"])
    await setup({ [invalid]: true, invalid: true });
});
test("executing one proposal invalidates all sibling proposals from the old generation", async () => {
  const f = await setup(),
    p = await f.reviewed(),
    q = await f.reviewed();
  f.advance(DAY);
  await f.finalize(p);
  await f.finalize(q);
  f.authority(f.pd, f.vault);
  await f.send(f.execute(p));
  f.advance(1n);
  await f.send(f.execute(q), f.developer, true);
});
test("a changed base executable prevents an otherwise approved upgrade", async () => {
  const f = await setup(),
    p = await f.reviewed();
  f.advance(DAY);
  await f.finalize(p);
  f.authority(f.pd, f.vault);
  const a = f.svm.getAccount(f.pd),
    data = Buffer.from(a.data);
  data[data.length - 1] ^= 1;
  f.svm.setAccount({ ...a, data });
  await f.send(f.execute(p), f.developer, true);
});

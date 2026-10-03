import { rehearsalState } from "../../lib/solana/rehearsal-state.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateKeyPairSigner } from "@solana/kit";
import { inspectLiveDaoRelease } from "../../lib/solana/dao-live-release.mjs";
import { daoAddress, daoAuthority } from "../../lib/solana/dao.mjs";
import {
  LOADER,
  TOKEN,
  pub,
  pda,
  concat,
  integer,
} from "../../lib/solana/program.mjs";
import { solanaNetwork } from "../../lib/solana/network.mjs";
test("live gate verifies one finalized account observation and rejects substitution", async () => {
  const key = async () => (await generateKeyPairSigner()).address;
  const program = await key();
  const expected = {
    target: await key(),
    mint: await key(),
    developer: await key(),
    treasury: await key(),
    reviewers: [await key(), await key(), await key()],
  };
  const bytes = Buffer.from("reviewed code");
  const release = {
    cluster: "devnet",
    program,
    expected,
    supply: "21000000000000",
    production: {
      developmentOnly: false,
      binaryLength: bytes.length,
      binarySha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
  const config = await daoAddress(program, expected.target),
    authority = await daoAuthority(program, config);
  const programAccount = async (p) =>
    Buffer.from(concat([integer(2, 4), pub(await pda(LOADER, pub(p)))]));
  const guard = Buffer.alloc(45 + bytes.length);
  guard.writeUInt32LE(3);
  bytes.copy(guard, 45);
  const target = Buffer.alloc(45);
  target.writeUInt32LE(3);
  target[12] = 1;
  target.set(pub(authority), 13);
  const state = Buffer.from(
    concat([
      Uint8Array.of(1),
      pub(expected.developer),
      pub(expected.target),
      pub(expected.mint),
      integer(release.supply),
      ...expected.reviewers.map(pub),
      pub(expected.treasury),
      integer(0),
      integer(0),
      integer(0),
    ]),
  );
  const mint = Buffer.alloc(82);
  mint.writeBigUInt64LE(BigInt(release.supply), 36);
  mint[44] = 6;
  mint[45] = 1;
  const raw = (data, owner = LOADER, executable = false) => ({
    owner,
    executable,
    data: [data.toString("base64"), "base64"],
  });
  const accounts = [
    raw(await programAccount(program), LOADER, true),
    raw(guard),
    raw(await programAccount(expected.target), LOADER, true),
    raw(target),
    raw(state, program),
    raw(mint, TOKEN),
  ];
  const rpcFor =
    (values, genesis = solanaNetwork("devnet").genesis) =>
    async (method, params) => {
      if (method === "getGenesisHash") return genesis;
      assert.equal(method, "getMultipleAccounts");
      assert.equal(params[1].commitment, "finalized");
      return { context: { slot: 100 }, value: values };
    };
  assert.equal(
    (await inspectLiveDaoRelease({ rpc: rpcFor(accounts), release })).status,
    "verified",
  );
  await assert.rejects(
    inspectLiveDaoRelease({ rpc: rpcFor(accounts, "wrong"), release }),
    /Wrong network/,
  );
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const changed = structuredClone(accounts);
    changed[index].owner = expected.developer;
    await assert.rejects(
      inspectLiveDaoRelease({ rpc: rpcFor(changed), release }),
    );
  }
  const mutable = Buffer.from(guard);
  mutable[12] = 1;
  const changed = [...accounts];
  changed[1] = raw(mutable);
  await assert.rejects(
    inspectLiveDaoRelease({ rpc: rpcFor(changed), release }),
    /immutable/,
  );
  await assert.rejects(
    inspectLiveDaoRelease({
      rpc: rpcFor(accounts),
      release: { ...release, supply: "1" },
    }),
    /denominator/,
  );
  await assert.rejects(
    inspectLiveDaoRelease({
      rpc: rpcFor(accounts),
      release: {
        ...release,
        production: { ...release.production, binarySha256: "00".repeat(32) },
      },
    }),
    /differs/,
  );

  const rehearsal = { ...release, disposable: true, publicActivation: false };
  const owner = expected.developer;
  const tokenData = Buffer.alloc(170);
  tokenData.set(pub(expected.mint));
  tokenData.set(pub(owner), 32);
  tokenData.writeBigUInt64LE(4200000000000n, 64);
  tokenData[108] = 1;
  tokenData.set([2, 7, 0, 0, 0], 165);
  const ownerRpc = async (method, params) => {
    if (method === "getMultipleAccounts" && params[0].length === 2) {
      assert.equal(params[1].minContextSlot, 100);
      return { context: { slot: 101 }, value: [raw(tokenData, TOKEN), null] };
    }
    return rpcFor(accounts)(method, params);
  };
  const holder = await rehearsalState({
    rpc: ownerRpc,
    release: rehearsal,
    owner,
  });
  assert.equal(holder.walletAmount, "4200000000000");
  assert.equal(holder.stakeAmount, "0");
  assert.equal(holder.matureAt, null);
  await assert.rejects(
    rehearsalState({ rpc: ownerRpc, release: rehearsal, owner: program }),
    /participant/,
  );
  await assert.rejects(
    rehearsalState({
      rpc: ownerRpc,
      release: { ...rehearsal, publicActivation: true },
      owner,
    }),
    /disposable/,
  );
  tokenData[0] ^= 1;
  await assert.rejects(
    rehearsalState({ rpc: ownerRpc, release: rehearsal, owner }),
    /token account/,
  );
});

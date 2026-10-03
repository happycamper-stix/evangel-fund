import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSigner } from "@solana/kit";
import { holderInstruction } from "../../lib/solana/dao-holder.mjs";
import { daoAddress, daoStake, daoEscrow } from "../../lib/solana/dao.mjs";
test("holder builder derives custody and rejects ambiguous or administrative actions", async () => {
  const signer = await generateKeyPairSigner();
  const key = async () => (await generateKeyPairSigner()).address;
  const input = {
    program: await key(),
    target: await key(),
    mint: await key(),
    signer,
    tokenAccount: await key(),
    proposal: await key(),
  };
  for (const bad of [
    { action: "execute" },
    { action: "deposit", amount: "0" },
    { action: "deposit", amount: "-1" },
    { action: "deposit", amount: "18446744073709551616" },
    { action: "deposit", amount: "1.5" },
    { action: "vote", approve: "false" },
    { action: "challenge", evidence: "00".repeat(32) },
  ])
    await assert.rejects(holderInstruction({ ...input, ...bad }));
  const ix = await holderInstruction({ ...input, action: "withdraw" });
  const config = await daoAddress(input.program, input.target);
  assert.equal(ix.accounts[1].address, config);
  assert.equal(
    ix.accounts[2].address,
    await daoStake(input.program, config, signer.address),
  );
  assert.equal(
    ix.accounts[3].address,
    await daoEscrow(input.program, config, signer.address),
  );
  assert.equal(ix.accounts[4].address, input.tokenAccount);
  assert.equal(ix.accounts[0].signer, signer);
});

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
  getTransactionEncoder,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getInitializeMint2Instruction,
  getInitializeAccount3Instruction,
  getMintToCheckedInstruction,
  getSetAuthorityInstruction,
  getTokenDecoder,
} from "@solana-program/token-2022";
import { TOKEN, SYSTEM, sha256 } from "../../lib/solana/program.mjs";
import { DAMM_V2 } from "../../lib/solana/venue-policy.mjs";
import {
  planOneSidedLaunch,
  encodeOneSidedInitialization,
  encodePermanentLock,
  venueAddresses,
} from "../../lib/solana/damm-plan.mjs";
const HASH = "4d5b920baebc090f89b2e8796a3452ed067c9667a143058c96a312f2c1e6848b";
for (const quoteAmount of [0n, 1n])
  test(`observed DAMM binary: quote transfer ${quoteAmount}, exact base deposit and lock`, async () => {
    const binary = await readFile(`.evangel/references/damm-v2-${HASH}.so`);
    assert.equal(createHash("sha256").update(binary).digest("hex"), HASH);
    const svm = new LiteSVM(),
      owner = await generateKeyPairSigner(),
      nft = await generateKeyPairSigner();
    svm.airdrop(owner.address, 100_000_000_000n);
    svm.addProgram(DAMM_V2.program, new Uint8Array(binary));
    async function send(ixs, fail = false) {
      let m = setTransactionMessageFeePayerSigner(
        owner,
        createTransactionMessage({ version: 0 }),
      );
      m = svm.setTransactionMessageLifetimeUsingLatestBlockhash(m);
      m = appendTransactionMessageInstructions(
        Array.isArray(ixs) ? ixs : [ixs],
        m,
      );
      const tx = await signTransactionMessageWithSigners(m);
      assert.ok(getTransactionEncoder().encode(tx).length <= 1232);
      const result = svm.sendTransaction(tx);
      if (!fail)
        assert.ok(
          !(result instanceof FailedTransactionMetadata),
          result instanceof FailedTransactionMetadata
            ? result.meta().logs().join("\n")
            : "",
        );
      return result;
    }
    async function asset(amount) {
      const mint = await generateKeyPairSigner(),
        account = await generateKeyPairSigner();
      await send([
        getCreateAccountInstruction({
          payer: owner,
          newAccount: mint,
          lamports: svm.minimumBalanceForRentExemption(82n),
          space: 82n,
          programAddress: TOKEN,
        }),
        getInitializeMint2Instruction({
          mint: mint.address,
          decimals: 6,
          mintAuthority: owner.address,
          freezeAuthority: null,
        }),
        getCreateAccountInstruction({
          payer: owner,
          newAccount: account,
          lamports: svm.minimumBalanceForRentExemption(165n),
          space: 165n,
          programAddress: TOKEN,
        }),
        getInitializeAccount3Instruction({
          account: account.address,
          mint: mint.address,
          owner: owner.address,
        }),
        ...(amount
          ? [
              getMintToCheckedInstruction({
                mint: mint.address,
                token: account.address,
                mintAuthority: owner,
                amount,
                decimals: 6,
              }),
            ]
          : []),
        getSetAuthorityInstruction({
          owned: mint.address,
          owner,
          authorityType: 0,
          newAuthority: null,
        }),
      ]);
      return { mint: mint.address, account: account.address };
    }
    const base = await asset(21_000_000_000_000n),
      quote = await asset(quoteAmount);
    const a = await venueAddresses(base.mint, quote.mint, nft.address),
      range = { sqrtMin: 1n << 64n, sqrtMax: 2n << 64n },
      plan = planOneSidedLaunch(range);
    const meta = (address, role = 0, signer) => ({
      address,
      role,
      ...(signer ? { signer } : {}),
    });
    const init = {
      programAddress: DAMM_V2.program,
      data: await encodeOneSidedInitialization(range),
      accounts: [
        meta(owner.address),
        meta(nft.address, 3, nft),
        meta(a.positionNftAccount, 1),
        meta(owner.address, 3, owner),
        meta(a.poolAuthority),
        meta(a.pool, 1),
        meta(a.position, 1),
        meta(base.mint),
        meta(quote.mint),
        meta(a.baseVault, 1),
        meta(a.quoteVault, 1),
        meta(base.account, 1),
        meta(quote.account, 1),
        meta(TOKEN),
        meta(TOKEN),
        meta(TOKEN),
        meta(SYSTEM),
        meta(a.eventAuthority),
        meta(DAMM_V2.program),
      ],
    };
    const balance = (k) =>
      getTokenDecoder().decode(svm.getAccount(k).data).amount;
    if (quoteAmount === 0n) {
      const failed = await send(init, true);
      assert.ok(failed instanceof FailedTransactionMetadata);
      assert.match(failed.meta().logs().join("\n"), /insufficient funds/i);
      assert.equal(svm.getAccount(a.pool).exists, false);
      assert.equal(balance(base.account), 21_000_000_000_000n);
      return;
    }
    await send(init);
    assert.equal(balance(a.baseVault), 14_700_000_000_000n);
    assert.equal(balance(a.quoteVault), 1n);
    assert.equal(balance(base.account), 6_300_000_000_000n);
    const lock = {
      programAddress: DAMM_V2.program,
      data: await encodePermanentLock(plan.liquidity),
      accounts: [
        meta(a.pool, 1),
        meta(a.position, 1),
        meta(a.positionNftAccount),
        meta(owner.address, 3, owner),
        meta(a.eventAuthority),
        meta(DAMM_V2.program),
      ],
    };
    const attacker = await generateKeyPairSigner();
    const forged = {
      ...lock,
      accounts: lock.accounts.map((entry, i) =>
        i === 3 ? meta(attacker.address, 2, attacker) : entry,
      ),
    };
    assert.ok((await send(forged, true)) instanceof FailedTransactionMetadata);
    await send(lock);
    const claim = {
      programAddress: DAMM_V2.program,
      data: (await sha256("global:claim_position_fee")).slice(0, 8),
      accounts: [
        meta(a.poolAuthority),
        meta(a.pool),
        meta(a.position, 1),
        meta(base.account, 1),
        meta(quote.account, 1),
        meta(a.baseVault, 1),
        meta(a.quoteVault, 1),
        meta(base.mint),
        meta(quote.mint),
        meta(a.positionNftAccount),
        meta(owner.address, 2, owner),
        meta(TOKEN),
        meta(TOKEN),
        meta(a.eventAuthority),
        meta(DAMM_V2.program),
      ],
    };
    await send(claim);
    assert.equal(balance(base.account), 6_300_000_000_000n);
    assert.equal(balance(quote.account), 0n);
    // No swaps yet: this proves the claim instruction remains callable after lock,
    // not positive fee accrual or Evangel's future receipt accounting.

    svm.expireBlockhash();
    assert.ok((await send(lock, true)) instanceof FailedTransactionMetadata);
  });

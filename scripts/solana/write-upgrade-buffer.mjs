import {
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import { LOADER, integer } from "../../lib/solana/program.mjs";
import { rpc, save, submit, finalized } from "./runtime.mjs";

// Caller validates network, pinned artifact, and existing buffer authority first.
export async function writeUpgradeBuffer({
  bytes,
  buffer,
  payer,
  staged,
  rent,
  createJournal = "venue-upgrade-buffer-create.json",
}) {
  if (!staged) {
    await submit(
      [
        getCreateAccountInstruction({
          payer,
          newAccount: buffer,
          lamports: BigInt(rent),
          space: BigInt(bytes.length + 37),
          programAddress: LOADER,
        }),
        {
          programAddress: LOADER,
          accounts: [
            { address: buffer.address, role: 1 },
            { address: payer.address, role: 0 },
          ],
          data: integer(0, 4),
        },
      ],
      payer,
      { journal: createJournal },
    );
  }
  const missing = [];
  for (let offset = 0; offset < bytes.length; offset += 900) {
    const chunk = bytes.subarray(offset, offset + 900);
    if (
      !staged ||
      !staged.data
        .subarray(37 + offset, 37 + offset + chunk.length)
        .equals(chunk)
    )
      missing.push({ offset, chunk });
  }
  let lastSignature;
  for (let i = 0; i < missing.length; i += 20) {
    const lifetime = (
      await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])
    ).value;
    for (const { offset, chunk } of missing.slice(i, i + 20)) {
      const data = Buffer.concat([
        Buffer.from(integer(1, 4)),
        Buffer.from(integer(offset, 4)),
        Buffer.from(integer(chunk.length)),
        chunk,
      ]);
      let msg = setTransactionMessageFeePayerSigner(
        payer,
        createTransactionMessage({ version: 0 }),
      );
      msg = setTransactionMessageLifetimeUsingBlockhash(
        {
          ...lifetime,
          lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight),
        },
        msg,
      );
      msg = appendTransactionMessageInstructions(
        [
          {
            programAddress: LOADER,
            accounts: [
              { address: buffer.address, role: 1 },
              { address: payer.address, role: 2, signer: payer },
            ],
            data,
          },
        ],
        msg,
      );
      const tx = await signTransactionMessageWithSigners(msg);
      const signature = getSignatureFromTransaction(tx),
        wire = getBase64EncodedWireTransaction(tx);
      await save(`upgrade-write-${signature}.json`, {
        signature,
        wire,
        offset,
        lastValidBlockHeight: lifetime.lastValidBlockHeight,
      });
      const returned = await rpc("sendTransaction", [
        wire,
        { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 3 },
      ]);
      if (returned !== signature)
        throw Error("Unexpected buffer write signature.");
      lastSignature = signature;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    console.log(
      `Buffer chunks submitted: ${Math.min(i + 20, missing.length)}/${missing.length}`,
    );
  }
  if (lastSignature) await finalized(lastSignature);
  // Caller must compare ALL finalized bytes before transferring buffer authority.
}

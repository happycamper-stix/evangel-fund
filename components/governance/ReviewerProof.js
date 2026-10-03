"use client";
import { useState } from "react";
import { getWallets } from "@wallet-standard/app";
import {
  createReviewerProof,
  reviewerMessage,
  verifyReviewerProof,
  signatureHex,
} from "@/lib/governance/reviewer-proof.mjs";
export default function ReviewerProof({ context }) {
  const [selected, setSelected] = useState(context.reviewers[0]);
  const [wallets, setWallets] = useState([]);
  const [connection, setConnection] = useState(null);
  const [proof, setProof] = useState(null);
  const [verified, setVerified] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function connect(wallet) {
    setBusy(true);
    setVerified(null);
    setConnection(null);
    setProof(null);
    try {
      const result = await wallet.features["standard:connect"].connect();
      const account = result.accounts.find(
        (a) =>
          a.address === selected && a.features.includes("solana:signMessage"),
      );
      if (!account)
        throw Error(
          "Select the configured address in your wallet, then connect again.",
        );
      const next = await createReviewerProof(context, account.address);
      setConnection({ wallet, account });
      setProof(next);
      setWallets([]);
      setMessage("Connected. Read the message below before signing.");
    } catch (error) {
      setMessage(error.message || "Could not connect wallet.");
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    setBusy(true);
    setVerified(null);
    try {
      const messageBytes = new TextEncoder().encode(reviewerMessage(proof));
      const [result] = await connection.wallet.features[
        "solana:signMessage"
      ].signMessage({ account: connection.account, message: messageBytes });
      if (
        !(result?.signedMessage instanceof Uint8Array) ||
        result.signedMessage.length !== messageBytes.length ||
        result.signedMessage.some((v, i) => v !== messageBytes[i])
      )
        throw Error("Wallet returned a different message. Proof rejected.");
      const signed = { ...proof, signature: signatureHex(result.signature) };
      await verifyReviewerProof(context, signed);
      setVerified(signed);
      setMessage(
        "Wallet control verified locally. Download the proof and share it with the deployment operator. It has not been submitted or registered on-chain.",
      );
    } catch (error) {
      setMessage(error.message || "Signing was canceled or failed.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(verified, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `evangel-devnet-proof-${selected}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="ev-card">
      <h2>Confirm your wallet</h2>
      <p>
        This is a message signature. No SOL is needed. It does not approve an
        upgrade or give Evangel permission to move funds.
      </p>
      <label htmlFor="participant">Participant wallet</label>
      <select
        id="participant"
        value={selected}
        disabled={busy}
        onChange={(e) => {
          setSelected(e.target.value);
          setConnection(null);
          setProof(null);
          setVerified(null);
          setWallets([]);
          setMessage("");
        }}
        style={{
          display: "block",
          width: "100%",
          margin: "12px 0",
          padding: 12,
        }}
      >
        {context.reviewers.map((key, i) => (
          <option key={key} value={key}>
            Reviewer {i + 1}: {key}
          </option>
        ))}
        <option value={context.developer}>
          Developer: {context.developer}
        </option>
      </select>
      <button
        className="ev-button"
        disabled={busy}
        onClick={() => {
          const found = getWallets()
            .get()
            .filter(
              (w) =>
                w.features["standard:connect"] &&
                w.features["solana:signMessage"],
            );
          setWallets(found);
          setMessage(
            found.length
              ? "Choose your wallet."
              : "No compatible wallet found. Open this page in a browser with Phantom or another Solana wallet that supports message signing.",
          );
        }}
      >
        Connect wallet
      </button>
      {wallets.map((w) => (
        <button
          className="ev-button"
          disabled={busy}
          key={w.name}
          onClick={() => connect(w)}
        >
          {w.name}
        </button>
      ))}
      {proof && (
        <>
          <h3>Message to sign</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 13,
            }}
          >
            {reviewerMessage(proof)}
          </pre>
          <button
            className="ev-button"
            disabled={busy || !!verified}
            onClick={sign}
          >
            Sign wallet-control message
          </button>
        </>
      )}
      {verified && (
        <button className="ev-button" onClick={download}>
          Download verification proof
        </button>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>
        Proofs expire after seven days and are bound to this exact candidate and
        participant list. They confirm control of keys, not reviewer
        independence or code review.
      </p>
    </section>
  );
}

"use client";
import { solanaNetwork } from "@/lib/solana/network.mjs";
const network = solanaNetwork();
import { createContext, useContext, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getTransactionEncoder,
  getBase58Decoder,
} from "@solana/kit";
const Context = createContext(null);
export const useSolana = () => useContext(Context);
export async function readRpc(method, extra = {}) {
  const res = await fetch("/api/solana/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error);
  return data.result;
}
export default function Wallet({ children, refresh }) {
  const [wallet, setWallet] = useState(null),
    [account, setAccount] = useState(null),
    [available, setAvailable] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [signature, setSignature] = useState("");
  async function connect(w) {
    try {
      const result = await w.features["standard:connect"].connect();
      const a = result.accounts.find(
        (a) =>
          a.chains.includes(network.chain) &&
          a.features.includes("solana:signAndSendTransaction"),
      );
      if (!a)
        throw Error(
          `This wallet does not expose Solana ${network.cluster} transaction signing.`,
        );
      setWallet(w);
      setAccount(a);
      setAvailable([]);
      setMessage(`Connected to Solana ${network.cluster}.`);
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setMessage("Preparing transaction…");
    setSignature("");
    try {
      await fn();
    } catch (e) {
      setMessage(e.message || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }
  async function send(instructions) {
    if (!wallet || !account) throw Error("Connect a Solana wallet first.");
    const lifetime = (await readRpc("getLatestBlockhash")).value;
    let m = createTransactionMessage({ version: 0 });
    m = setTransactionMessageFeePayer(account.address, m);
    m = setTransactionMessageLifetimeUsingBlockhash(
      {
        ...lifetime,
        lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight),
      },
      m,
    );
    m = appendTransactionMessageInstructions(instructions, m);
    const tx = getTransactionEncoder().encode(compileTransaction(m));
    const [result] = await wallet.features[
      "solana:signAndSendTransaction"
    ].signAndSendTransaction({
      account,
      chain: network.chain,
      transaction: tx,
      options: { preflightCommitment: "confirmed" },
    });
    const sig = getBase58Decoder().decode(result.signature);
    setSignature(sig);
    setMessage("Submitted. Waiting for finalization…");
    for (let n = 0; n < 45; n++) {
      const status = (await readRpc("getSignatureStatuses", { signature: sig }))
        .value[0];
      if (status?.err) throw Error("Transaction failed onchain.");
      if (status?.confirmationStatus === "finalized") {
        setMessage(`Finalized on Solana ${network.cluster}.`);
        await refresh();
        return sig;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMessage("Finalization pending. Check the explorer before retrying.");
    return sig;
  }
  return (
    <Context.Provider value={{ account: account?.address, busy, run, send }}>
      <div className="sol-wallet">
        <button
          className="ev-button"
          type="button"
          onClick={() => {
            if (account) {
              setAccount(null);
              setWallet(null);
              setMessage("Disconnected.");
              return;
            }
            const found = getWallets()
              .get()
              .filter(
                (w) =>
                  w.features["standard:connect"] &&
                  w.features["solana:signAndSendTransaction"],
              );
            setAvailable(found);
            if (!found.length)
              setMessage(
                "Install a Wallet Standard-compatible Solana wallet and enable the selected development network.",
              );
          }}
        >
          {account
            ? `${account.address.slice(0, 5)}…${account.address.slice(-5)} · disconnect`
            : "Connect Solana wallet"}
        </button>
        {available.map((w) => (
          <button className="ev-button" key={w.name} onClick={() => connect(w)}>
            {w.name}
          </button>
        ))}
        <p role="status">{message}</p>
        {signature && (
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://explorer.solana.com/tx/${signature}?cluster=${network.cluster}`}
          >
            View transaction ↗
          </a>
        )}
      </div>
      {children}
    </Context.Provider>
  );
}

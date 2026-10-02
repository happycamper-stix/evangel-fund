"use client";
import { useCallback, useEffect, useState } from "react";
import { createNoopSigner } from "@solana/kit";
import Wallet, { useSolana, readRpc } from "@/components/solana/Wallet";
import {
  reviewedInstruction,
  reviewerMember,
} from "@/lib/governance/reviewer.mjs";
import {
  createProposal,
  approveProposal,
  executeProposal,
  assertTransactionMatches,
  transactionAddress,
} from "@/lib/solana/squads.mjs";
import "@/components/solana/solana.css";
export default function Reviewer() {
  const [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/solana/state", { cache: "no-store" });
      const value = await r.json();
      if (!r.ok) throw Error(value.error);
      setSnapshot(value);
      setError("");
      return value;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  return (
    <section className="ev-card">
      <h2>Reviewer workspace</h2>
      <p>
        Use a configured reviewer wallet. Read the governor report and its
        evidence before signing. Uploaded JSON is untrusted; a matching hash
        alone does not prove that a governor approved it.
      </p>
      {error && <p role="alert">{error}</p>}
      <Wallet refresh={refresh}>
        <Actions snapshot={snapshot} refresh={refresh} />
      </Wallet>
    </section>
  );
}
function Actions({ snapshot, refresh }) {
  const { account, run, send, busy } = useSolana();
  const [text, setText] = useState(""),
    [index, setIndex] = useState(""),
    [accepted, setAccepted] = useState(false);
  const governance = snapshot?.governance;
  let action = null,
    parseError = "";
  if (text)
    try {
      if (text.length > 20000) throw Error("Action file is too large.");
      action = JSON.parse(text);
      if (snapshot) reviewedInstruction(action, snapshot);
    } catch (e) {
      parseError = e.message;
      action = null;
    }
  async function transact(mode) {
    await run(async () => {
      const current = await refresh();
      reviewerMember(current, account);
      if (!accepted)
        throw Error("Review the action and evidence before signing.");
      const intent = JSON.parse(text),
        inner = reviewedInstruction(intent, current, {
          creating: mode === "create",
        }),
        member = createNoopSigner(account),
        multisig = current.governance.address;
      const n =
        mode === "create"
          ? BigInt(current.governance.transactionIndex) + 1n
          : BigInt(index);
      if (n < 1n || n > 18446744073709551615n)
        throw Error("Invalid proposal index.");
      if (mode === "create") {
        const p = await createProposal({
          multisig,
          index: n,
          member,
          instruction: inner,
        });
        await send([p.create, p.propose]);
        setIndex(String(n));
      } else {
        const raw = (
          await readRpc("getAccountInfo", {
            address: await transactionAddress(multisig, n),
          })
        ).value;
        if (!raw) throw Error("Proposal transaction not found.");
        await assertTransactionMatches({
          multisig,
          index: n,
          instruction: inner,
          account: {
            owner: raw.owner,
            data: Uint8Array.from(atob(raw.data[0]), (c) => c.charCodeAt(0)),
          },
        });
        await send([
          await (mode === "approve"
            ? approveProposal({ multisig, index: n, member })
            : executeProposal({
                multisig,
                index: n,
                member,
                instruction: inner,
              })),
        ]);
      }
      setAccepted(false);
    });
  }
  return (
    <div className="sol-form">
      {governance ? (
        <p>
          {governance.threshold}-of-{governance.members.length} ·{" "}
          {governance.timeLock / 3600}-hour execution delay · Latest proposal
          index: {governance.transactionIndex}
        </p>
      ) : (
        <p>Governance deployment unavailable.</p>
      )}
      <label>
        Verified action JSON from the governor
        <textarea
          rows={8}
          maxLength={20000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAccepted(false);
          }}
        />
      </label>
      {parseError && <p role="alert">{parseError}</p>}
      {action && (
        <div>
          <h3>Action: {action.action}</h3>
          <p>Network: {action.cluster}</p>
          <p>
            Execution expires:{" "}
            {new Date(action.executionExpiresAt * 1000).toISOString()}
          </p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(
              {
                program: action.program,
                multisig: action.multisig,
                args: action.args,
                accounts: action.accounts,
                reportHash: action.reportHash,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
      <label>
        Existing proposal index
        <input
          inputMode="numeric"
          pattern="[0-9]+"
          value={index}
          onChange={(e) => {
            setIndex(e.target.value);
            setAccepted(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />{" "}
        I reviewed the exact action, recipients, amounts, report and source
        evidence.
      </label>
      <button
        className="ev-button"
        disabled={busy || !action || !accepted || !account}
        onClick={() => transact("create")}
      >
        Create proposal
      </button>
      <button
        className="ev-button"
        disabled={
          busy || !action || !accepted || !account || !/^\d+$/.test(index)
        }
        onClick={() => transact("approve")}
      >
        Compare and approve proposal
      </button>
      <button
        className="ev-button"
        disabled={
          busy || !action || !accepted || !account || !/^\d+$/.test(index)
        }
        onClick={() => transact("execute")}
      >
        Compare and execute after delay
      </button>
      <p>
        Creation does not approve a proposal. Two members must approve
        separately. Squads enforces the delay and the factory enforces action
        expiry and payout rules.
      </p>
    </div>
  );
}

"use client";
import { useState } from "react";
import { createNoopSigner } from "@solana/kit";
import { useSolana, readRpc } from "./Wallet";
import { governedInstruction } from "@/lib/solana/program.mjs";
import { GOVERNANCE_ACTIONS } from "@/lib/governance/policy.mjs";
import {
  createProposal,
  approveProposal,
  executeProposal,
  assertTransactionMatches,
  transactionAddress,
} from "@/lib/solana/squads.mjs";
export default function GovernancePanel({ data }) {
  const { account, busy, run, send } = useSolana(),
    [action, setAction] = useState(null),
    [index, setIndex] = useState("");
  if (!data.governance?.members.some((m) => m.address === account)) return null;
  const member = createNoopSigner(account),
    multisig = data.governance.address;
  function inner() {
    if (!action || action.executionExpiresAt < Math.floor(Date.now() / 1000))
      throw Error("Governance action expired; obtain a fresh review");
    return governedInstruction(
      data.config.program,
      action.action,
      action.args,
      [
        data.factory.authority,
        data.factory.address,
        ...action.accounts,
        multisig,
      ],
      action.executionExpiresAt,
    );
  }
  async function reviewed() {
    if (!/^[1-9]\d*$/.test(index)) throw Error("Enter a proposal index");
    const instruction = inner(),
      address = await transactionAddress(multisig, BigInt(index));
    const raw = (await readRpc("getAccountInfo", { address })).value;
    if (!raw) throw Error("Proposal transaction not found");
    const accountData = {
      owner: raw.owner,
      data: Uint8Array.from(atob(raw.data[0]), (c) => c.charCodeAt(0)),
    };
    await assertTransactionMatches({
      multisig,
      index: BigInt(index),
      instruction,
      account: accountData,
    });
    return { multisig, index: BigInt(index), member, instruction };
  }
  return (
    <details className="ev-card">
      <summary>Governance proposals · 2 of 3 approvals</summary>
      <p>
        Review the evidence and exact action independently. Approved proposals
        wait at least two days before execution. The agent holds no key.
      </p>
      <label className="sol-field">
        <span>Verified agent action JSON</span>
        <input
          type="file"
          accept="application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            run(async () => {
              if (file.size > 20000) throw Error("Action file is too large");
              const a = JSON.parse(await file.text());
              if (
                a.version !== 2 ||
                a.program !== data.config.program ||
                a.authority !== data.factory.authority ||
                a.multisig !== multisig ||
                !GOVERNANCE_ACTIONS.includes(a.action) ||
                !Array.isArray(a.accounts) ||
                !Number.isSafeInteger(a.executionExpiresAt) ||
                a.executionExpiresAt < Math.floor(Date.now() / 1000) ||
                a.executionExpiresAt > Math.floor(Date.now() / 1000) + 7 * 86400
              )
                throw Error("Wrong deployment, unsupported or expired action");
              setAction(a);
            });
          }}
        />
      </label>
      {action && (
        <>
          <pre className="sol-action">{JSON.stringify(action, null, 2)}</pre>
          <button
            className="ev-button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (
                  !Number.isSafeInteger(action.expiresAt) ||
                  action.expiresAt < Date.now() ||
                  action.expiresAt > Date.now() + 300000
                )
                  throw Error("Reverify the report before creating a proposal");
                const i = BigInt(data.governance.transactionIndex) + 1n,
                  plan = await createProposal({
                    multisig,
                    index: i,
                    member,
                    instruction: inner(),
                  });
                await send([plan.create, plan.propose]);
                setIndex(i.toString());
              })
            }
          >
            Create proposal for review
          </button>
          <label className="sol-field">
            <span>Proposal index</span>
            <input
              inputMode="numeric"
              value={index}
              onChange={(e) => setIndex(e.target.value)}
            />
          </label>
          <button
            className="ev-button"
            disabled={busy || !index}
            onClick={() =>
              run(async () => send([await approveProposal(await reviewed())]))
            }
          >
            Approve this exact proposal
          </button>
          <button
            className="ev-button"
            disabled={busy || !index}
            onClick={() =>
              run(async () => send([await executeProposal(await reviewed())]))
            }
          >
            Execute after quorum and delay
          </button>
        </>
      )}
    </details>
  );
}

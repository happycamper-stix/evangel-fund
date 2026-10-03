"use client";
import { useCallback, useEffect, useState } from "react";
import { createNoopSigner } from "@solana/kit";
import Wallet, { useSolana, readRpc } from "@/components/solana/Wallet";
import {
  createProposal,
  approveProposal,
  executeProposal,
  assertTransactionMatches,
  transactionAddress,
} from "@/lib/solana/squads.mjs";
export default function Upgrade() {
  const [state, setState] = useState(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/solana/upgrade", { cache: "no-store" }),
        s = await r.json();
      if (!r.ok) throw Error(s.error);
      setState(s);
      setError("");
      return s;
    } catch (e) {
      setState(null);
      setError(e.message);
      throw e;
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  return (
    <section className="ev-card" id="upgrade">
      <h2>Devnet program upgrade</h2>
      <p>
        Review the staged adapter, then use your configured member wallet.
        Creating a proposal does not approve it.
      </p>
      <p>
        <a
          href="https://github.com/happycamper-stix/evangel-fund/blob/main/docs/DEVNET_UPGRADE_RUNBOOK.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the upgrade evidence ↗
        </a>
      </p>
      {error && <p role="alert">{error}</p>}
      {state?.status === "deployed" ? (
        <p role="status">
          Reviewed code is deployed. Deployment baseline verification and the
          remaining launch gates still apply.
        </p>
      ) : (
        <Wallet refresh={refresh}>
          <UpgradeActions state={state} refresh={refresh} />
        </Wallet>
      )}
    </section>
  );
}
function UpgradeActions({ state, refresh }) {
  const { account, run, send, busy } = useSolana();
  const [index, setIndex] = useState(""),
    [accepted, setAccepted] = useState(false);
  const member = state?.governance?.members.some(
    (m) => m.address === account && m.permissions === 7,
  );
  const enabled = state?.status === "ready" && member && accepted && !busy;
  async function act(mode) {
    await run(async () => {
      const fresh = await refresh();
      if (
        !accepted ||
        fresh.status !== "ready" ||
        !fresh.governance.members.some(
          (m) => m.address === account && m.permissions === 7,
        )
      )
        throw Error(
          "A configured member must review the ready upgrade before signing.",
        );
      if (
        fresh.binarySha256 !== state.binarySha256 ||
        fresh.buffer !== state.buffer
      )
        throw Error("Upgrade changed; review again.");
      const signer = createNoopSigner(account),
        multisig = fresh.governance.address;
      const n =
        mode === "create"
          ? BigInt(fresh.governance.transactionIndex) + 1n
          : BigInt(index);
      if (n < 1n || n > 18446744073709551615n)
        throw Error("Enter a valid proposal index.");
      const { dataHex, ...ix } = fresh.instruction;
      const instruction = {
        ...ix,
        data: Uint8Array.from(dataHex.match(/../g), (b) => parseInt(b, 16)),
      };
      if (mode === "create") {
        const p = await createProposal({
          multisig,
          index: n,
          member: signer,
          instruction,
        });
        await send([p.create, p.propose]);
        setIndex(String(n));
      } else {
        const raw = (
          await readRpc("getAccountInfo", {
            address: await transactionAddress(multisig, n),
          })
        ).value;
        if (!raw) throw Error("Proposal not found.");
        await assertTransactionMatches({
          multisig,
          index: n,
          instruction,
          account: {
            owner: raw.owner,
            data: Uint8Array.from(atob(raw.data[0]), (c) => c.charCodeAt(0)),
          },
        });
        await send([
          await (mode === "approve"
            ? approveProposal({ multisig, index: n, member: signer })
            : executeProposal({
                multisig,
                index: n,
                member: signer,
                instruction,
              })),
        ]);
      }
      setAccepted(false);
    });
  }
  return (
    <div className="sol-form">
      {state && (
        <>
          <p>
            {state.governance.threshold}-of-{state.governance.members.length}{" "}
            approval · {state.governance.timeLock / 3600}-hour delay · Latest
            proposal: {state.governance.transactionIndex}
          </p>
          <p style={{ overflowWrap: "anywhere" }}>
            Reviewed SHA-256: {state.binarySha256}
          </p>
          <details>
            <summary>Exact upgrade accounts</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(state.instruction, null, 2)}
            </pre>
          </details>
        </>
      )}
      <label>
        Upgrade proposal index
        <input
          inputMode="numeric"
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
        />
        I reviewed the upgrade source, hash, buffer and account destinations.
      </label>
      {account && !member && (
        <p>This wallet is not a configured governance member.</p>
      )}
      <button
        className="ev-button"
        disabled={!enabled}
        onClick={() => act("create")}
      >
        Create upgrade proposal
      </button>
      <button
        className="ev-button"
        disabled={!enabled || !/^\d+$/.test(index)}
        onClick={() => act("approve")}
      >
        Compare and approve upgrade
      </button>
      <button
        className="ev-button"
        disabled={!enabled || !/^\d+$/.test(index)}
        onClick={() => act("execute")}
      >
        Execute approved upgrade
      </button>
      <p>
        Two members must approve. Squads enforces the 48-hour delay onchain.
        This workspace cannot bypass it or enable public trading.
      </p>
    </div>
  );
}

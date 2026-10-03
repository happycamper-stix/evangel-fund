"use client";
import { useCallback, useEffect, useState } from "react";
import { createNoopSigner } from "@solana/kit";
import Wallet, { useSolana } from "@/components/solana/Wallet";
import { holderInstruction } from "@/lib/solana/dao-holder.mjs";
async function fetchState(owner) {
  const r = await fetch(
    `/api/solana/dao/rehearsal${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`,
    { cache: "no-store" },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Rehearsal unavailable");
  return data;
}
export default function RehearsalDeposit() {
  return (
    <section className="ev-card" id="deposit">
      <h2>Deposit Devnet voting tokens</h2>
      <p>
        Switch your wallet to Solana Devnet. Your wallet has been allocated
        TESTGOV tokens and 0.02 Devnet SOL for this rehearsal. These are test
        assets. Depositing starts a seven-day waiting period before your tokens
        can count toward a new proposal.
      </p>
      <Wallet refresh={async () => {}}>
        <DepositActions />
      </Wallet>
    </section>
  );
}
function DepositActions() {
  const { account, busy, run, send } = useSolana();
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await fetchState(account);
      setState(data);
      setError("");
      return data;
    } catch (e) {
      setState(null);
      setError(e.message);
      throw e;
    }
  }, [account]);
  useEffect(() => {
    setState(null);
    setAccepted(false);
    setError("");
    if (account) refresh().catch(() => {});
  }, [account, refresh]);
  async function act(action) {
    await run(async () => {
      if (!accepted)
        throw Error("Confirm that you understand the test-token lock.");
      const fresh = await refresh();
      if (
        fresh.owner !== account ||
        fresh.cluster !== "devnet" ||
        fresh.disposable !== true
      )
        throw Error("Wallet or network mismatch");
      if (
        action === "deposit" &&
        (fresh.stakeAmount !== "0" || BigInt(fresh.walletAmount) <= 0n)
      )
        throw Error("No eligible balance to deposit");
      const ix = await holderInstruction({
        program: fresh.program,
        target: fresh.target,
        mint: fresh.mint,
        signer: createNoopSigner(account),
        action,
        tokenAccount: fresh.tokenAccount,
        amount: fresh.walletAmount,
      });
      await send([ix]);
      await refresh();
    });
  }
  const units = (value) =>
    (Number(BigInt(value || "0")) / 1e6).toLocaleString();
  return (
    <div>
      {account && (
        <button
          className="ev-button"
          disabled={busy}
          onClick={() => refresh().catch(() => {})}
        >
          Refresh verified balance
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {account && state && state.owner === account && (
        <>
          <p>
            Wallet: {units(state.walletAmount)} TESTGOV · Deposited:{" "}
            {units(state.stakeAmount)} TESTGOV
          </p>
          {state.matureAt && (
            <p>
              Eligible for proposals created on or after{" "}
              {new Date(Number(state.matureAt) * 1000).toUTCString()}.
            </p>
          )}
          {Number(state.lockedUntil) > 0 && (
            <p>
              Current withdrawal lock ends:{" "}
              {new Date(Number(state.lockedUntil) * 1000).toUTCString()}.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            I understand these are Devnet test tokens. Participating in a
            challenge or vote locks the deposit through the voting deadline.
            Withdrawing and redepositing restarts maturity.
          </label>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <button
              className="ev-button"
              disabled={
                busy ||
                !accepted ||
                state.stakeAmount !== "0" ||
                state.walletAmount === "0"
              }
              onClick={() => act("deposit")}
            >
              Deposit test voting balance
            </button>
            <button
              className="ev-button"
              disabled={
                busy ||
                !accepted ||
                state.stakeAmount === "0" ||
                Number(state.lockedUntil) * 1000 > Date.now()
              }
              onClick={() => act("withdraw")}
            >
              Withdraw test voting balance
            </button>
          </div>
          <p>
            No top-ups: an active deposit must be withdrawn before its amount
            can change. Onchain rules decide whether withdrawal is allowed.
          </p>
        </>
      )}
    </div>
  );
}

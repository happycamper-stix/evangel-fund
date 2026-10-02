"use client";
import { useSolana } from "./Wallet";
import { feeDayAddresses, TOKEN } from "@/lib/solana/program.mjs";
import { FOUNDATION } from "@/lib/solana/config.mjs";
const amount = (v) => Number(BigInt(v || 0)) / 1e6;
export default function FeePanel({ data, call, enabled, ata }) {
  const { account, run, send } = useSolana();
  if (!data.factory) return null;
  async function payout(d, name, owner, receipt) {
    const dest = await ata(data.factory.quoteMint, owner, account);
    const { feeVault } = await feeDayAddresses(
      data.config.program,
      d.project,
      BigInt(d.day),
    );
    return send([
      dest.ix,
      call(name, { day: BigInt(d.day) }, [
        d.project,
        d.address,
        ...(receipt ? [receipt] : []),
        feeVault,
        data.factory.quoteMint,
        dest.address,
        TOKEN,
      ]),
    ]);
  }
  return (
    <section className="ev-card">
      <h2>Project fee treasuries</h2>
      <p>
        5% per buy or sell: 3% development · 0.5% contributors · 1.35%
        governance · 0.15% foundation.
      </p>
      <p className="sol-note">
        Unused governance funding returns to the originating project after each
        UTC day. Testnet amounts use dummy e/acc. Approved unpaid costs remain
        reserved.
      </p>
      {!(data.feeDays || []).length && <p>No trading fees recorded.</p>}
      {(data.feeDays || []).map((d) => {
        const project = data.projects.find((p) => p.address === d.project);
        const closed = Number(d.day) < Math.floor(Date.now() / 86400000);
        return (
          <article className="sol-milestone" key={d.address}>
            <h3>
              {project?.name || d.project} ·{" "}
              {new Date(Number(d.day) * 86400000).toISOString().slice(0, 10)}{" "}
              UTC
            </h3>
            <p>
              {amount(d.development)} development · {amount(d.community)}{" "}
              contributor funding · {amount(d.governance)} unused governance ·{" "}
              {amount(d.expenseCommitted)} approved unpaid costs ·{" "}
              {amount(d.foundation)} foundation (e/acc)
            </p>
            {!d.settled && (
              <button
                className="ev-button"
                disabled={!enabled || !closed}
                onClick={() =>
                  run(() =>
                    send([
                      call("settleFeeDay", { day: BigInt(d.day) }, [
                        d.project,
                        d.address,
                      ]),
                    ]),
                  )
                }
              >
                Settle daily surplus
              </button>
            )}
            <button
              className="ev-button"
              disabled={
                !enabled || !project?.adopted || BigInt(d.development) === 0n
              }
              onClick={() =>
                run(() => payout(d, "claimDevelopment", project.owner))
              }
            >
              Send development income to project owner
            </button>
            <button
              className="ev-button"
              disabled={!enabled || BigInt(d.foundation) === 0n}
              onClick={() =>
                run(() => payout(d, "claimQuoteFoundation", FOUNDATION))
              }
            >
              Send foundation allocation
            </button>
            {(data.expenses || [])
              .filter((e) => e.feeDay === d.address && e.status === 0)
              .map((e) => (
                <p key={e.address}>
                  Governance expense: {amount(e.amount)} e/acc · payable{" "}
                  {new Date(Number(e.readyAt) * 1000).toLocaleString()}{" "}
                  <button
                    className="ev-button"
                    disabled={!enabled || Number(e.readyAt) > Date.now() / 1000}
                    onClick={() =>
                      run(() =>
                        payout(
                          d,
                          "claimQuoteExpense",
                          data.factory.authority,
                          e.address,
                        ),
                      )
                    }
                  >
                    Pay approved expense
                  </button>
                </p>
              ))}
          </article>
        );
      })}
    </section>
  );
}

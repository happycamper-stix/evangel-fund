"use client";
import { solanaNetwork } from "@/lib/solana/network.mjs";
import { useState, useEffect, useCallback } from "react";
import { createNoopSigner } from "@solana/kit";
import { getCreateAssociatedTokenIdempotentInstruction } from "@solana-program/token-2022";
import { SiteHeader, SiteFooter } from "../site/SiteChrome";
import Wallet, { useSolana } from "./Wallet";
import BuilderPath from "@/components/site/BuilderPath";
import Link from "next/link";
import FeePanel from "./FeePanel";
import GovernancePanel from "./GovernancePanel";
import { FOUNDATION } from "@/lib/solana/config.mjs";
import {
  pda,
  pub,
  integer,
  launchAddresses,
  feeDayAddresses,
  instruction,
  TOKEN,
  SYSTEM,
  sha256,
  hex,
  units,
  quote,
} from "@/lib/solana/program.mjs";
import "./solana.css";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const format = (value, decimals = 6) =>
  Number(BigInt(value || 0)) / 10 ** decimals;
const when = (value) => new Date(Number(value) * 1000).toLocaleString();
const link = (key) =>
  `https://explorer.solana.com/address/${key}?cluster=${solanaNetwork().cluster}`;
function Field({ label, ...props }) {
  return (
    <label className="sol-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function Text({ label, ...props }) {
  return (
    <label className="sol-field">
      <span>{label}</span>
      <textarea rows={4} {...props} />
    </label>
  );
}
async function ata(mint, owner, payer) {
  const address = await pda(ATA, pub(owner), pub(TOKEN), pub(mint));
  return {
    address,
    ix: getCreateAssociatedTokenIdempotentInstruction(
      { payer: createNoopSigner(payer), ata: address, owner, mint },
      { programAddress: ATA },
    ),
  };
}
export default function Platform({ mode, config }) {
  const [data, setData] = useState({
      config,
      projects: [],
      milestones: [],
      submissions: [],
      sponsorships: [],
    }),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/solana/state", { cache: "no-store" }),
        body = await res.json();
      if (!res.ok) throw Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <div className="ev-app">
      <SiteHeader active={mode === "fund" ? "/fund" : "/launch"} />
      <main id="page-main" className="site-guide">
        <header className="site-guide-intro">
          <p className="ev-kicker">
            SOLANA / {mode === "fund" ? "OPEN-SOURCE WORK" : "SOCIAL LAUNCHES"}
          </p>
          <h1>
            {mode === "fund"
              ? "Fund open-source projects."
              : "Explore community tokens."}
          </h1>
          <p>
            {mode === "fund"
              ? "Choose a project to view its funding, milestones, and contributor rewards."
              : "Browse tokens linked to projects and creators. Public launches and trading are not yet available."}
          </p>
        </header>
        <BuilderPath active={mode === "fund" ? "/fund" : "/launch"} />
        {!config.configured && (
          <section className="ev-card">
            <h2>Testnet deployment pending</h2>
            <p>
              The native Solana program is not connected to this website yet.
              Launches and payments remain disabled until a verified program
              address is published.
            </p>
          </section>
        )}
        {error && <p role="alert">{error}</p>}
        <Wallet refresh={refresh}>
          <Content data={data} mode={mode} />
        </Wallet>
      </main>
      <SiteFooter />
    </div>
  );
}
function Content({ data, mode }) {
  // Legacy curve controls exist only for the isolated development browser fixture.
  const fixtureTrading =
    process.env.NODE_ENV === "development" && data.config.testFixture === true;
  const { account, busy, run, send } = useSolana(),
    [selected, setSelected] = useState("");
  const enabled = Boolean(
      data.config.configured && data.factory && account && !busy,
    ),
    program = data.config.program,
    fa = data.factory?.address;
  const call = (name, args, acc) =>
    instruction(program, name, args, [
      account,
      fa,
      ...acc,
      ...(data.factory?.governanceMultisig &&
      data.factory.governanceMultisig !== SYSTEM
        ? [data.factory.governanceMultisig]
        : []),
    ]);
  const transact = (name, args, acc) =>
    run(() => send([call(name, args, acc)]));
  const p = data.projects.find((p) => p.address === selected);
  return (
    <div className="ev-stack">
      {mode === "launch" && !data.config.launchEnabled && (
        <section className="ev-card">
          <h2>Token launches are not available yet</h2>
          <p>
            Launches are being tested on Devnet. You can explore the model or
            start with repository funding while trading remains disabled.
          </p>
        </section>
      )}
      <section className="ev-card">
        <h2>
          {mode === "fund" ? "Choose a project to fund" : "Choose a token project"}
        </h2>
        {!data.projects.filter((project) => mode === "fund" || !project.tokenless).length ? (
          <p>No projects are available in this view yet.</p>
        ) : (
          <div className="sol-list">
            {data.projects
              .filter((p) => mode === "fund" || !p.tokenless)
              .map((p) => (
                <button
                  key={p.address}
                  className="sol-project"
                  aria-pressed={selected === p.address}
                  onClick={() => setSelected(p.address)}
                >
                  {p.name} {p.symbol && `· $${p.symbol}`}
                  <span>{p.adopted ? "Adopted by project owner" : "Awaiting owner adoption"}</span>
                </button>
              ))}
          </div>
        )}
      </section>
      {p && (
        <Project
          p={p}
          data={data}
          call={call}
          transact={transact}
          enabled={enabled}
        />
      )}
      <section className="ev-card">
        <h2>
          {mode === "fund"
            ? "Add a repository for funding"
            : "Launch a community coin"}
        </h2>
        <p className="sol-note">{mode === "fund" ? "Add a public GitHub repository to create its funding page. Adding it does not verify ownership." : "Create a token linked to a public project or creator when launches become available."} <Link href="/verify">Verify your GitHub role</Link></p>
        {!account && <p className="sol-note">Connect your Solana wallet above to submit this form.</p>}
        <form
          className="sol-form"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            run(async () => {
              const source = new URL(String(d.get("source")));
              if (
                source.protocol !== "https:" ||
                source.username ||
                source.password
              )
                throw Error("Use a public HTTPS URL.");
              if (mode === "fund") {
                if (
                  source.hostname !== "github.com" ||
                  source.pathname.split("/").filter(Boolean).length !== 2
                )
                  throw Error("Use a GitHub repository root URL.");
                source.pathname = source.pathname.replace(/\/$/, "");
                source.search = "";
                source.hash = "";
                const key = await sha256(source.href),
                  project = await pda(program, "project", key);
                await send([
                  call(
                    "registerFund",
                    { name: String(d.get("name")), source: source.href },
                    [project, SYSTEM],
                  ),
                ]);
                setSelected(project);
              } else {
                if (!data.config.launchEnabled || !fixtureTrading)
                  throw Error(
                    "Reviewed venue launch and sponsorship are not enabled.",
                  );
                const keys = await launchAddresses(
                  program,
                  account,
                  BigInt(data.factory.count),
                );
                await send([
                  call(
                    "launch",
                    {
                      name: String(d.get("name")),
                      symbol: String(d.get("symbol")).toUpperCase(),
                      source: source.href,
                      virtualQuote: units(d.get("virtual"), 6),
                    },
                    [
                      keys.project,
                      keys.mint,
                      keys.pool,
                      keys.reserve,
                      SYSTEM,
                      TOKEN,
                      data.factory.quoteMint,
                      keys.quotePool,
                    ],
                  ),
                ]);
                setSelected(keys.project);
              }
            });
          }}
        >
          <Field label="Project name" name="name" required maxLength={64} />
          {mode === "launch" && (
            <>
              <Field
                label="Ticker (A–Z)"
                name="symbol"
                required
                pattern="[a-zA-Z]{1,12}"
                maxLength={12}
              />
              {fixtureTrading && (
                <Field
                  label="Virtual starting e/acc (local test fixture)"
                  name="virtual"
                  type="number"
                  min="1000"
                  step="any"
                  defaultValue="1000"
                  required
                />
              )}
            </>
          )}
          <Field
            label={
              mode === "fund"
                ? "GitHub repository URL"
                : "Repository, post or creator URL"
            }
            name="source"
            type="url"
            required
            maxLength={512}
          />
          <button
            className="ev-button"
            disabled={
              !enabled ||
              (mode === "launch" &&
                (!data.config.launchEnabled || !fixtureTrading))
            }
          >
            {mode === "fund" ? "Register repository" : "Create coin"}
          </button>
          <p className="sol-note">
            Network fees and account rent require development-network SOL.
            Registration does not imply owner endorsement.
          </p>
        </form>
      </section>
      <details className="workspace-tools">
        <summary>
          Project operations <span>Fees, settlement & governance</span>
        </summary>
        <div className="ev-stack">
          <GovernancePanel data={data} />
          <FeePanel data={data} call={call} enabled={enabled} ata={ata} />
        </div>
      </details>
    </div>
  );
}
function Project({ p, data, call, transact, enabled }) {
  const { account, run, send } = useSolana();
  const mine = account === p.owner;
  const allowance =
    210000000000n -
    p.releases
      .filter((r) => Number(r.at) + 21 * 86400 > Date.now() / 1000)
      .reduce((total, r) => total + BigInt(r.amount), 0n);
  const milestones = data.milestones.filter((m) => m.project === p.address);
  return (
    <section className="ev-card sol-detail">
      <h2>
        {p.name} {p.symbol && `/ ${p.symbol}`}
      </h2>
      <p>
        <a href={p.source} target="_blank" rel="noreferrer">
          Project source ↗
        </a>{" "}
        ·{" "}
        <a href={link(p.address)} target="_blank" rel="noreferrer">
          Onchain account ↗
        </a>
      </p>
      {!p.tokenless && (
        <p>
          21M fixed supply · 70% token liquidity · 1% upfront after adoption ·
          29% milestone reserve
        </p>
      )}
      {!p.tokenless && (
        <p>
          Developer released: {format(p.devReleased)} · Workers released:{" "}
          {format(p.workerReleased)} · Available in this rolling window:{" "}
          {format(allowance)}
        </p>
      )}
      <p>
        SOL for OSS work: {format(p.solAvailable, 9)} available ·{" "}
        {format(p.solCommitted, 9)} committed
      </p>
      {!p.adopted && (
        <details>
          <summary>Adopt this project</summary>
          <form
            className="sol-form"
            onSubmit={(e) => {
              e.preventDefault();
              const terms = String(new FormData(e.currentTarget).get("terms"));
              run(async () =>
                send([
                  call("requestAdoption", { terms: await sha256(terms) }, [
                    p.address,
                  ]),
                ]),
              );
            }}
          >
            <Text
              label="Owner adoption terms (publish in the repository before requesting approval)"
              name="terms"
              required
            />
            <button className="ev-button" disabled={!enabled}>
              Request verified adoption
            </button>
          </form>
          <p className="sol-note">
            The agent must verify source ownership, wallet binding and accepted
            terms. Adoption approval has a two-day challenge period.
          </p>
          {Number(p.adoptionAt) > 0 && (
            <>
              <p>Adoption ready: {when(p.adoptionAt)}</p>
              <button
                className="ev-button"
                disabled={!enabled}
                onClick={() =>
                  run(async () => {
                    if (p.tokenless)
                      return send([call("finalizeAdoption", {}, [p.address])]);
                    const ownerToken = await ata(p.mint, p.owner, account),
                      reserve = await pda(
                        data.config.program,
                        "reserve",
                        pub(p.address),
                      );
                    return send([
                      ownerToken.ix,
                      call("finalizeAdoption", {}, [
                        p.address,
                        p.mint,
                        reserve,
                        ownerToken.address,
                        TOKEN,
                      ]),
                    ]);
                  })
                }
              >
                Finalize approved adoption
              </button>
              <EvidenceAction
                label="Challenge adoption"
                enabled={enabled}
                onSubmit={(reason) =>
                  transact("challenge", { reason }, [p.address, p.address])
                }
              />
            </>
          )}
        </details>
      )}
      {!p.tokenless && (
        <Trade p={p} data={data} call={call} enabled={enabled} />
      )}
      {p.adopted && (
        <>
          <details>
            <summary>Sponsor OSS work with SOL</summary>
            <form
              className="sol-form"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                run(async () => {
                  const nonce = BigInt(Date.now()),
                    receipt = await pda(
                      data.config.program,
                      "sponsor",
                      pub(p.address),
                      pub(account),
                      integer(nonce),
                    );
                  await send([
                    call(
                      "sponsor",
                      { amount: units(d.get("amount"), 9), nonce },
                      [p.address, receipt, SYSTEM],
                    ),
                  ]);
                });
              }}
            >
              <Field
                label="Funding amount (SOL)"
                name="amount"
                type="number"
                min="0.000000001"
                step="any"
                required
              />
              <button className="ev-button" disabled={!enabled}>
                Sponsor work
              </button>
              <p className="sol-note">
                Refundable by you for 24 hours. After that, anyone may settle it
                into the project's milestone budget.
              </p>
            </form>
          </details>
          {data.sponsorships
            .filter((r) => r.project === p.address && !r.settled)
            .map((r) => (
              <div key={r.address} className="sol-row">
                <p>
                  {format(r.amount, 9)} SOL · refund window ends {when(r.until)}
                </p>
                <button
                  className="ev-button"
                  disabled={!enabled}
                  onClick={() =>
                    transact("settleSponsorship", { refund: false }, [
                      p.address,
                      r.address,
                    ])
                  }
                >
                  Settle after window
                </button>
                {r.sponsor === account && (
                  <button
                    className="ev-button"
                    disabled={!enabled}
                    onClick={() =>
                      transact("settleSponsorship", { refund: true }, [
                        p.address,
                        r.address,
                      ])
                    }
                  >
                    Refund before deadline
                  </button>
                )}
              </div>
            ))}
          {mine && (
            <MilestoneForm p={p} data={data} call={call} enabled={enabled} />
          )}
        </>
      )}
      <h3>Milestones & community work</h3>
      {!milestones.length && <p>No onchain milestones yet.</p>}
      {milestones.map((m) => (
        <article key={m.address} className="sol-milestone">
          <h4>
            Milestone {m.id} ·{" "}
            {m.community ? "Community work" : "Developer work"}
          </h4>
          <p>
            {format(m.amount, m.solReward ? 9 : 6)}{" "}
            {Number(m.quoteDay) >= 0 ? "e/acc" : m.solReward ? "SOL" : p.symbol}{" "}
            ·{" "}
            {
              [
                "Awaiting agent",
                "Plan approved",
                "Completion approved",
                "Challenged",
                "Paid",
                "Rejected",
              ][m.status]
            }{" "}
            · revision {m.revision}
          </p>
          <p>
            <a href={m.uri} target="_blank" rel="noreferrer">
              Acceptance criteria ↗
            </a>{" "}
            · Deadline {when(m.deadline)}
          </p>
          {m.status === 1 && (
            <EvidenceAction
              label="Submit work for review"
              enabled={
                enabled &&
                (m.community
                  ? account !== p.owner && account !== data.factory.authority
                  : mine)
              }
              onSubmit={(evidence) =>
                run(async () => {
                  const work = await pda(
                    data.config.program,
                    "work",
                    pub(m.address),
                    pub(account),
                    integer(m.revision),
                  );
                  return send([
                    call("submitWork", { evidence }, [
                      p.address,
                      m.address,
                      work,
                      SYSTEM,
                    ]),
                  ]);
                })
              }
            />
          )}{" "}
          {m.status === 2 && (
            <>
              <p>
                Release eligible after {when(m.readyAt)} and within the shared
                token allowance.
              </p>
              <button
                className="ev-button"
                disabled={!enabled}
                onClick={() =>
                  run(async () => {
                    if (Number(m.quoteDay) >= 0) {
                      const dest = await ata(
                        data.factory.quoteMint,
                        m.worker,
                        account,
                      );
                      const { feeDay, feeVault } = await feeDayAddresses(
                        data.config.program,
                        p.address,
                        BigInt(m.quoteDay),
                      );
                      return send([
                        dest.ix,
                        call("pay", {}, [
                          p.address,
                          m.address,
                          feeDay,
                          feeVault,
                          data.factory.quoteMint,
                          dest.address,
                          TOKEN,
                        ]),
                      ]);
                    }
                    if (m.solReward)
                      return send([
                        call("pay", {}, [p.address, m.address, m.worker]),
                      ]);
                    const dest = await ata(p.mint, m.worker, account),
                      reserve = await pda(
                        data.config.program,
                        "reserve",
                        pub(p.address),
                      );
                    return send([
                      dest.ix,
                      call("pay", {}, [
                        p.address,
                        m.address,
                        p.mint,
                        reserve,
                        dest.address,
                        TOKEN,
                      ]),
                    ]);
                  })
                }
              >
                Execute approved payout
              </button>
            </>
          )}
          {[1, 2].includes(m.status) && (
            <EvidenceAction
              label="Dispute a decision"
              enabled={enabled}
              onSubmit={(reason) =>
                transact("challenge", { reason }, [p.address, m.address])
              }
            />
          )}
          {data.submissions
            .filter(
              (work) =>
                work.milestone === m.address && work.revision === m.revision,
            )
            .map((work) => (
              <p key={work.address}>
                <a href={link(work.address)} target="_blank" rel="noreferrer">
                  Submitted work: {work.worker.slice(0, 6)}… ↗
                </a>
              </p>
            ))}
          <p className="sol-note">
            The agent approves scope and completion separately. Failed work
            keeps its budget and reopens for community workers.
          </p>
        </article>
      ))}
    </section>
  );
}
function EvidenceAction({ label, enabled, onSubmit }) {
  return (
    <details>
      <summary>{label}</summary>
      <form
        className="sol-form"
        onSubmit={(e) => {
          e.preventDefault();
          const text = String(new FormData(e.currentTarget).get("evidence"));
          sha256(text).then(onSubmit);
        }}
      >
        <Text
          label="Evidence record (publish the identical text at a commit-pinned URL for agent review)"
          name="evidence"
          required
        />
        <button className="ev-button" disabled={!enabled}>
          {label}
        </button>
      </form>
    </details>
  );
}
function MilestoneForm({ p, data, call, enabled }) {
  const { run, send } = useSolana();
  const [rewardAsset, setRewardAsset] = useState("sol");
  return (
    <details>
      <summary>Propose a milestone to the agent</summary>
      <form
        className="sol-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          run(async () => {
            if (
              d.get("asset") === "quote" &&
              d.get("beneficiary") !== "community"
            )
              throw Error(
                "e/acc contributor fees fund community work only. Claim developer income from the project fee treasury.",
              );
            const solReward = d.get("asset") === "sol",
              terms = String(d.get("terms")),
              parsed = JSON.parse(terms);
            for (const key of [
              "objective",
              "acceptanceCriteria",
              "ossImpact",
              "evidenceRequired",
            ])
              if (typeof parsed[key] !== "string" || !parsed[key].trim())
                throw Error(`Milestone document needs ${key}`);
            const id = BigInt(p.milestoneCount) + 1n,
              ma = await pda(
                data.config.program,
                "milestone",
                pub(p.address),
                integer(id),
              );
            return send([
              call(
                d.get("asset") === "quote"
                  ? "proposeQuoteMilestone"
                  : "proposeMilestone",
                {
                  day: BigInt(d.get("feeDay") || 0),
                  community: d.get("beneficiary") === "community",
                  solReward,
                  amount: units(d.get("amount"), solReward ? 9 : 6),
                  deadline: BigInt(
                    Math.floor(new Date(d.get("deadline")).getTime() / 1000),
                  ),
                  terms: await sha256(terms),
                  uri: String(d.get("uri")),
                },
                [p.address, ma, SYSTEM],
              ),
            ]);
          });
        }}
      >
        <label className="sol-field">
          <span>Reward asset</span>
          <select
            name="asset"
            value={rewardAsset}
            onChange={(e) => {
              setRewardAsset(e.target.value);
              if (e.target.value === "quote")
                e.target.form.elements.beneficiary.value = "community";
            }}
          >
            <option value="sol">Sponsored SOL</option>
            {!p.tokenless && (
              <>
                <option value="token">Project reserve tokens</option>
                <option value="quote">
                  e/acc contributor fees (community only)
                </option>
              </>
            )}
          </select>
        </label>
        {!p.tokenless && (
          <label className="sol-field">
            <span>Fee day for e/acc community reward</span>
            <select name="feeDay">
              {(data.feeDays || [])
                .filter((d) => d.project === p.address)
                .map((d) => (
                  <option key={d.address} value={d.day}>
                    {new Date(Number(d.day) * 86400000)
                      .toISOString()
                      .slice(0, 10)}{" "}
                    · {format(d.community)} e/acc available
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="sol-field">
          <span>Work recipient</span>
          <select name="beneficiary">
            <option value="community">Community worker</option>
            <option value="developer" disabled={rewardAsset === "quote"}>
              Repo owner payroll
            </option>
          </select>
        </label>
        <Field
          label="Reward amount"
          name="amount"
          type="number"
          min="0.000000001"
          step="any"
          required
        />
        <Field
          label="Submission deadline"
          name="deadline"
          type="datetime-local"
          required
        />
        <Text
          label="Published milestone JSON: objective, acceptanceCriteria, ossImpact, evidenceRequired"
          name="terms"
          required
        />
        <Field
          label="URL of the identical document (GitHub file pinned to a full commit)"
          name="uri"
          type="url"
          required
        />
        <button className="ev-button" disabled={!enabled}>
          Propose milestone
        </button>
      </form>
    </details>
  );
}
function Trade({ p, data, call, enabled }) {
  const [buy, setBuy] = useState(true),
    [value, setValue] = useState("");
  if (
    process.env.NODE_ENV !== "development" ||
    data.config.testFixture !== true
  )
    return (
      <p className="sol-note">
        Venue trading will be available after the reviewed deployment and public
        pilot.
      </p>
    );
  let preview;
  try {
    preview = quote(p, buy, units(value, 6));
  } catch {}
  return (
    <details>
      <summary>Trade {p.symbol}</summary>
      <div className="sol-form">
        <TradeControls
          {...{ p, data, call, enabled, buy, setBuy, value, setValue, preview }}
        />
      </div>
    </details>
  );
}
function TradeControls({
  p,
  data,
  call,
  enabled,
  buy,
  setBuy,
  value,
  setValue,
  preview,
}) {
  const { account, run, send } = useSolana();
  return (
    <>
      <label className="sol-field">
        <span>Direction</span>
        <select
          value={buy ? "buy" : "sell"}
          onChange={(e) => setBuy(e.target.value === "buy")}
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </label>
      <Field
        label={buy ? "e/acc to spend" : "Tokens to sell"}
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      {preview && (
        <p>
          Estimated receive: {format(preview.out, 6)} {buy ? p.symbol : "e/acc"}{" "}
          · 5% fee · 1% slippage limit
        </p>
      )}
      <button
        type="button"
        className="ev-button"
        disabled={!enabled || !preview || preview.out <= 0n}
        onClick={() =>
          run(async () => {
            const amount = units(value, 6),
              q = quote(p, buy, amount),
              minOut = (q.out * 99n) / 100n;
            if (minOut <= 0n) throw Error("Trade output too small");
            const dest = await ata(p.mint, account, account),
              pool = await pda(data.config.program, "pool", pub(p.address));
            const quoteDest = await ata(
              data.factory.quoteMint,
              account,
              account,
            );
            const day = BigInt(Math.floor(Date.now() / 86400000));
            const { feeDay, feeVault } = await feeDayAddresses(
              data.config.program,
              p.address,
              day,
            );
            const quotePool = await pda(
              data.config.program,
              "quote-pool",
              pub(p.address),
            );
            const initialize = (data.feeDays || []).some(
              (d) => d.address === feeDay,
            )
              ? []
              : [
                  call("initializeFeeDay", { day }, [
                    p.address,
                    feeDay,
                    feeVault,
                    data.factory.quoteMint,
                    SYSTEM,
                    TOKEN,
                  ]),
                ];
            return send([
              dest.ix,
              quoteDest.ix,
              ...initialize,
              call(
                "swap",
                {
                  buy,
                  amount,
                  minOut,
                  deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
                },
                [
                  p.address,
                  p.mint,
                  pool,
                  dest.address,
                  SYSTEM,
                  TOKEN,
                  data.factory.quoteMint,
                  quotePool,
                  quoteDest.address,
                  feeDay,
                  feeVault,
                ],
              ),
            ]);
          })
        }
      >
        Confirm {buy ? "buy" : "sell"}
      </button>
      <p className="sol-note">
        Real pool reserve: {format(p.quoteReserve, 6)} e/acc. Virtual e/acc is
        never withdrawable.
      </p>
    </>
  );
}

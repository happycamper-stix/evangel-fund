import { feeDayDust } from "../../lib/solana/fee-policy.mjs";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
import { NETWORK, ROOT } from "./runtime.mjs";
// Read-only development-network invariant monitor. Scheduling and notifications are deliberately separate.
import { readFile } from "node:fs/promises";
import { governanceDrift } from "../../lib/solana/governance-baseline.mjs";
import { state, rpc } from "../../lib/solana/state.mjs";
import { TOKEN, LOADER } from "../../lib/solana/program.mjs";
import { getAddressDecoder } from "@solana/kit";
import { getMintDecoder, getTokenDecoder } from "@solana-program/token-2022";
import { pda, pub } from "../../lib/solana/program.mjs";
const alerts = [];
try {
  const snapshot = await state();
  if (process.env.EVANGEL_MONITOR_WEB === "true") {
    const response = await fetch("https://evangel.fund/api/solana/state", {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok)
      alerts.push({
        issue: "Public state endpoint unavailable",
        status: response.status,
      });
    else {
      const live = await response.json();
      if (
        live.config?.program !== snapshot.config.program ||
        live.config?.cluster !== NETWORK.cluster
      )
        alerts.push({
          issue: "Website deployment differs from monitored cluster/program",
        });
    }
  }
  if (!snapshot.factory) {
    console.log(
      JSON.stringify({
        status: "alert",
        reason: "No verified custody deployment configured",
      }),
    );
    process.exit(1);
  }
  async function account(address) {
    const a = (
      await rpc("getAccountInfo", [
        address,
        { encoding: "base64", commitment: "finalized" },
      ])
    ).value;
    if (!a) throw Error("A required custody account is missing");
    return { ...a, bytes: Buffer.from(a.data[0], "base64") };
  }
  async function covered(address, amount) {
    const a = await account(address),
      rent = BigInt(
        await rpc("getMinimumBalanceForRentExemption", [a.bytes.length]),
      );
    if (BigInt(a.lamports) < rent + amount)
      alerts.push({
        address,
        issue: "Insufficient backing for recorded liabilities",
      });
  }
  const f = snapshot.factory;
  let baseline = null;
  try {
    baseline = JSON.parse(
      await readFile(
        process.env.EVANGEL_DEPLOYMENT_BASELINE ||
          (NETWORK.cluster === "devnet"
            ? "docs/DEVNET_ADDRESSES.json"
            : `${ROOT}/factory-deployment.json`),
        "utf8",
      ),
    );
  } catch {}
  for (const issue of governanceDrift(
    snapshot.governance,
    baseline,
    snapshot.config.program,
  ))
    alerts.push({ issue });

  for (const d of snapshot.feeDays || []) {
    const va = await pda(snapshot.config.program, "fee-vault", pub(d.address));
    const raw = await account(va),
      token = getTokenDecoder().decode(raw.bytes);
    let liabilities = [
      "development",
      "community",
      "communityCommitted",
      "governance",
      "expenseCommitted",
      "foundation",
    ].reduce((n, k) => n + BigInt(d[k]), 0n);
    if (!d.settled) {
      const fees = BigInt(d.fees);
      liabilities += feeDayDust(fees, d.policy);
    }
    const workCommitted = snapshot.milestones
      .filter(
        (m) =>
          m.project === d.project &&
          m.quoteDay === d.day &&
          [1, 2, 3].includes(m.status),
      )
      .reduce((sum, m) => sum + BigInt(m.amount), 0n);
    if (workCommitted !== BigInt(d.communityCommitted))
      alerts.push({
        address: d.address,
        issue: "Community quote commitments do not reconcile",
      });
    if (
      raw.owner !== TOKEN ||
      token.owner !== d.address ||
      token.mint !== f.quoteMint ||
      token.amount < liabilities
    )
      alerts.push({
        address: va,
        issue: "Quote custody backing or binding mismatch",
      });
    const committed = snapshot.expenses
      .filter((e) => e.feeDay === d.address && e.status === 0)
      .reduce((n, e) => n + BigInt(e.amount), 0n);
    if (committed !== BigInt(d.expenseCommitted))
      alerts.push({
        address: d.address,
        issue: "Quote expenses do not reconcile",
      });
    if (d.settled && BigInt(d.governance) !== 0n)
      alerts.push({
        address: d.address,
        issue: "Settled day retains unused governance funds",
      });
  }
  for (const p of snapshot.projects) {
    await covered(
      p.address,
      ["solAvailable", "solCommitted", "refundable"].reduce(
        (n, k) => n + BigInt(p[k]),
        0n,
      ),
    );
    if (BigInt(p.solFunded) > 10_000_000_000n)
      alerts.push({ address: p.address, issue: "Pilot funding cap exceeded" });
    if (p.tokenless) continue;
    const quotePool = await pda(
      snapshot.config.program,
      "quote-pool",
      pub(p.address),
    );
    const qa = await account(quotePool),
      q = getTokenDecoder().decode(qa.bytes);
    if (
      qa.owner !== TOKEN ||
      q.owner !== p.address ||
      q.mint !== f.quoteMint ||
      q.amount < BigInt(p.quoteReserve)
    )
      alerts.push({
        address: quotePool,
        issue: "Trading quote reserve mismatch",
      });
    const ma = await account(p.mint),
      m = getMintDecoder().decode(ma.bytes);
    if (
      ma.owner !== TOKEN ||
      m.mintAuthority.__option !== "None" ||
      m.freezeAuthority.__option !== "None" ||
      m.decimals !== 6 ||
      m.supply > 21_000_000_000_000n
    )
      alerts.push({
        address: p.mint,
        issue: "Unexpected token authority or supply",
      });
    const reserve = await pda(
        snapshot.config.program,
        "reserve",
        pub(p.address),
      ),
      ra = await account(reserve),
      r = getTokenDecoder().decode(ra.bytes);
    if (
      ra.owner !== TOKEN ||
      r.owner !== p.address ||
      r.mint !== p.mint ||
      r.amount <
        6_300_000_000_000n - BigInt(p.devReleased) - BigInt(p.workerReleased)
    )
      alerts.push({
        address: reserve,
        issue: "Governed token reserve mismatch",
      });
  }
  const pa = await account(snapshot.config.program);
  if (pa.owner !== LOADER || !pa.executable || pa.bytes.readUInt32LE() !== 2)
    throw Error("Unexpected program loader");
  const pd = await account(
    getAddressDecoder().decode(pa.bytes.subarray(4, 36)),
  );
  if (pd.owner !== LOADER || pd.bytes.readUInt32LE() !== 3)
    throw Error("Invalid program data");
  if (baseline?.cluster !== NETWORK.cluster)
    throw Error("Deployment baseline network mismatch");
  verifyProgramBytes(pd.bytes.subarray(45), baseline);
  const upgradeAuthority =
    pd.bytes[12] === 1
      ? getAddressDecoder().decode(pd.bytes.subarray(13, 45))
      : null;
  if (upgradeAuthority && upgradeAuthority !== f.authority)
    alerts.push({ issue: "Upgrade authority is not the governance vault" });
  console.log(
    JSON.stringify(
      {
        status: alerts.length ? "alert" : "ok",
        cluster: NETWORK.cluster,
        program: snapshot.config.program,
        governance: snapshot.governance,
        upgradeAuthority,
        projects: snapshot.projects.length,
        alerts,
      },
      null,
      2,
    ),
  );
  if (alerts.length) process.exitCode = 1;
} catch (error) {
  console.log(
    JSON.stringify({
      status: "alert",
      reason: "Could not verify all custody and governance invariants",
      detail: error.message,
    }),
  );
  process.exitCode = 1;
}

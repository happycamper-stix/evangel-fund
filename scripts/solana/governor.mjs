import { ROOT, NETWORK } from "./runtime.mjs";
import { createClerkClient } from "@clerk/backend";
import { verifyRepository } from "../../lib/identity/github.mjs";
import {
  invoiceIdentity,
  milestoneDocument,
  approvalAllowed,
} from "../../lib/governance/validation.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { state } from "../../lib/solana/state.mjs";
import { evaluateEvidence } from "../../lib/governance/inference.mjs";
import {
  verifyArtifact,
  enforceEvidencePolicy,
} from "../../lib/governance/evidence.mjs";
import { POLICY, GOVERNANCE_ACTIONS } from "../../lib/governance/policy.mjs";
import {
  instruction,
  governedInstruction,
  pda,
  hashBytes,
  SYSTEM,
} from "../../lib/solana/program.mjs";
const [
  mode,
  inputPath,
  evidencePath,
  outputPath = `${ROOT}/agent-decision.json`,
] = process.argv.slice(2);
if (!["evaluate", "verify"].includes(mode) || !inputPath || !evidencePath)
  throw Error(
    "Usage: governor.mjs evaluate|verify request-or-report.json evidence.json [output.json]",
  );
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const input = JSON.parse(await readFile(inputPath, "utf8")),
  evidence = JSON.parse(await readFile(evidencePath, "utf8")),
  request = mode === "evaluate" ? input : input.request;
if (
  !GOVERNANCE_ACTIONS.includes(request.action) ||
  !Array.isArray(request.accounts)
)
  throw Error("Unsupported governance action");
if (!Array.isArray(evidence) || !evidence.length || evidence.length > 30)
  throw Error("Provide 1–30 pinned artifacts");
const snapshot = await state();
if (!snapshot.factory) throw Error("Factory not deployed");
if (request.accounts.at(-1) !== snapshot.factory.governanceMultisig)
  throw Error(
    "Request must end with the configured governance multisig account",
  );
const verification = await Promise.all(
  evidence.map(async (a) =>
    typeof a.content === "string" &&
    typeof a.url === "string" &&
    createHash("sha256").update(a.content).digest("hex") === a.contentHash
      ? verifyArtifact(a)
      : { verified: false },
  ),
);
const context = {
  factory: snapshot.factory,
  governance: snapshot.governance,
  accounts: request.accounts.map(
    (address) =>
      [
        ...snapshot.projects,
        ...snapshot.milestones,
        ...snapshot.submissions,
        ...(snapshot.feeDays || []),
        ...(snapshot.expenses || []),
      ].find((a) => a.address === address) || { address },
  ),
};
// Financial reviews must include the exact sealed terms and submitted delivery, not merely unrelated citations.
if (request.action === "approveQuoteExpense") {
  let verifiedInvoice = false;
  for (let i = 0; i < evidence.length; i++) {
    if (!verification[i]?.verified) continue;
    try {
      const record = JSON.parse(evidence[i].content);
      if (
        (await invoiceIdentity(record)) === request.args.invoice &&
        record.amountQuoteUnits === String(request.args.amount) &&
        record.quoteMint === snapshot.factory.quoteMint &&
        record.project === request.accounts[0] &&
        record.bookingDay === String(request.args.day)
      )
        verifiedInvoice = true;
    } catch {
      /* Unrelated artifacts do not authorize an expense. */
    }
  }
  if (!verifiedInvoice)
    throw Error(
      "Verify a pinned inference/API invoice with the exact amount and canonical provider/invoiceId identity",
    );
}
const milestone = context.accounts.find((a) => a.tag === 3);
const submission = context.accounts.find((a) => a.tag === 4);
if (
  milestone &&
  !evidence.some(
    (a, i) =>
      a.contentHash === milestone.terms &&
      a.url === milestone.uri &&
      verification[i]?.verified,
  )
)
  throw Error(
    "The exact published milestone document must be independently verified.",
  );
if (
  request.action === "award" &&
  (!submission ||
    !evidence.some(
      (a, i) =>
        a.contentHash === submission.evidence && verification[i]?.verified,
    ))
)
  throw Error(
    "The exact contributor evidence record must be independently verified.",
  );
if (request.action === "approveAdoption") {
  const project = context.accounts.find((a) => a.tag === 2);
  if (
    !project ||
    !evidence.some(
      (a, i) =>
        a.contentHash === project.adoptionHash && verification[i]?.verified,
    )
  )
    throw Error(
      "Verify the exact published adoption terms and wallet binding.",
    );
}
// Re-query provider identity on both evaluation and verification. Client proof JSON is never authority.
if (["approveAdoption", "award"].includes(request.action)) {
  const project =
    request.action === "approveAdoption"
      ? context.accounts.find((a) => a.tag === 2)
      : snapshot.projects.find((a) => a.address === milestone?.project);
  if (!project || !request.identity?.userId || !process.env.CLERK_SECRET_KEY)
    throw Error(
      "Verified GitHub and Solana identity is required before approval.",
    );
  const identity = await verifyRepository({
    client: createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    userId: request.identity.userId,
    repository: project.source,
    wallet:
      request.action === "approveAdoption"
        ? request.args.owner
        : submission.worker,
    pullRequest: request.identity.pullRequest,
  });
  if (
    request.action === "approveAdoption" &&
    !["owner", "admin", "maintainer"].includes(identity.role)
  )
    throw Error(
      "Repository control is required for adoption; contributor history alone is insufficient.",
    );
  // Stable facts enter the report context; fresh timestamps intentionally do not.
  const { checkedAt, expiresAt, ...facts } = identity;
  context.identity = facts;
}
if (milestone)
  milestoneDocument(
    evidence.find((a) => a.contentHash === milestone.terms).content,
  );
// Validate encoding before inference; all transaction accounts are part of the sealed request.
instruction(
  snapshot.config.program,
  request.action,
  { ...request.args, report: "01".repeat(32) },
  [snapshot.factory.authority, snapshot.factory.address, ...request.accounts],
);
let report;
if (mode === "evaluate") {
  const decision = enforceEvidencePolicy(
    await evaluateEvidence({
      instructions: POLICY,
      context: JSON.stringify({
        request,
        context,
        artifacts: evidence,
        verification,
      }),
    }),
    verification,
  );
  report = {
    version: 1,
    program: snapshot.config.program,
    authority: snapshot.factory.authority,
    createdAt: Date.now(),
    request,
    contextHash: digest(context),
    evidenceHash: digest(evidence),
    decision,
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    `Agent decision: ${decision.verdict}. Report written; no transaction signed.`,
  );
} else {
  report = input;
  if (
    report.version !== 1 ||
    report.program !== snapshot.config.program ||
    report.authority !== snapshot.factory.authority ||
    report.contextHash !== digest(context) ||
    report.evidenceHash !== digest(evidence) ||
    !Number.isSafeInteger(report.createdAt) ||
    Date.now() - report.createdAt > 3600000 ||
    report.createdAt > Date.now()
  )
    throw Error("Stale or mismatched report");
  const d = report.decision;
  if (!approvalAllowed(d, verification))
    throw Error("Evidence policy does not permit this action");
  const args = { ...request.args, report: digest(report) };
  const accounts = [...request.accounts];
  if (request.action === "fundOss") {
    args.evidence = args.report;
    accounts.push(
      await pda(report.program, "oss", hashBytes(args.evidence)),
      SYSTEM,
    );
  }
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        version: 3,
        cluster: NETWORK.cluster,
        genesis: NETWORK.genesis,
        program: report.program,
        multisig: snapshot.factory.governanceMultisig,
        executionExpiresAt: Math.floor(Date.now() / 1000) + 7 * 86400,
        authority: report.authority,
        expiresAt: Date.now() + 300000,
        action: request.action,
        args,
        accounts,
        reportHash: args.report,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Verified unsigned action written. The authority wallet must submit it.",
  );
}

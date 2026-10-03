import Upgrade from "@/components/governance/Upgrade";
import Reviewer from "@/components/governance/Reviewer";
import GuidePage from "@/components/site/SiteChrome";
import { inferenceStatus } from "@/lib/governance/inference.mjs";
export const dynamic = "force-dynamic";
export const metadata = {
  alternates: { canonical: "/governor" },
  openGraph: { url: "/governor", siteName: "Evangel", type: "website" },
  title: "Evangel governor",
};
export default function GovernorPage() {
  const status = inferenceStatus();
  return (
    <GuidePage
      active="/governor"
      kicker="EVIDENCE BEFORE APPROVAL"
      title="Governance & approvals."
      description="Evidence review for community decisions and open-source worker rewards."
    >
      <section className="ev-card">
        <h2>Holder challenges · candidate rules</h2>
        <p>
          Developers manage ordinary product work. Program upgrades require two
          reviewers to inspect the exact build before a six-hour holder
          challenge window opens.
        </p>
        <p>
          1% of the fixed voting supply can escalate a change to a 72-hour vote.
          It then needs 30% turnout and more than two-thirds of votes in favor.
          A tie or insufficient turnout blocks the change.
        </p>
        <p>
          Voting tokens must be deposited at least seven days before proposal
          creation and stay locked through the vote. Votes cannot authorize
          another project's assets.
        </p>
        <p>
          Development-only deployments can execute after two inspections, with
          fast mode expiring after 14 days. The public-release build has no fast
          mode.
        </p>
        <p>
          Holders can replace lost signing keys through a mandatory vote. Every
          replacement key must sign acceptance; recovery cannot change the
          voting token or treasury.
        </p>
        <p>
          <strong>Not active on Devnet yet.</strong> The voting mint and
          immutable upgrade guard must be verified before authority migration.
          Existing custody remains under its current multisig rules.
        </p>
        <a
          className="ev-link"
          href="https://github.com/happycamper-stix/evangel-fund/blob/main/docs/DAO_GOVERNANCE.md"
        >
          Read the voting rules and rollout gates →
        </a>
      </section>
      <Upgrade />
      <Reviewer />
      <section className="ev-card">
        <h2>Evidence-based project review</h2>
        <p>
          Vercel AI Gateway supplies model inference. No agent token, token
          launch, staking vault or token enrollment is required.
        </p>
        <p>
          {status.configured
            ? "Inference credentials and model are configured; availability is checked when a review runs."
            : "Inference configuration is pending. No live evaluation is claimed."}
        </p>
        <p>
          Reports cite submitted evidence. Unverifiable work requires
          abstention. The agent finalizes milestone criteria and verifies
          delivery. Independent reviewers approve the exact action through a
          2-of-3 Squads vault; a report alone moves no funds.
        </p>
      </section>
      <section className="ev-card">
        <h2>Independent approval before execution</h2>
        <p>
          The foundation and two independent reviewers hold governance roles
          through an autonomous Squads vault. The evaluator has no wallet key.
          One signer cannot approve an action alone; quorum execution waits at
          least two days.
        </p>
        <p>
          Contract limits, expiring actions and challenge periods still apply.
          Reviewers must verify evidence and disclose conflicts. Multisig
          approval is not a proof of useful work.
        </p>
      </section>
      <section className="ev-card">
        <h2>For e/acc and open-source workers</h2>
        <p>
          Existing assets retain their supply and contract rules. Worker funding
          uses published milestones, contributor authorization and evidence of
          delivery.
        </p>
        <p>
          The existing e/acc token address on Solana is verified. The native
          factory pairs projects with e/acc. Public trading awaits a verified
          venue and independent pricing.
        </p>
      </section>
    </GuidePage>
  );
}

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
      title="Back the work. Check the proof."
      description="Evidence review for community decisions and open-source worker rewards."
    >
      <Upgrade />
      <Reviewer />
      <section className="ev-card">
        <h2>Review without a platform token</h2>
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
          Evangel has no platform token. Existing assets retain their supply and
          contract rules. Worker funding uses published milestones, contributor
          authorization and evidence of delivery.
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

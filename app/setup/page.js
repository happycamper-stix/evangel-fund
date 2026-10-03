import { solanaNetwork } from "@/lib/solana/network.mjs";
export const metadata = {
  alternates: { canonical: "/setup" },
  openGraph: { url: "/setup", siteName: "Evangel", type: "website" },
};
import GuidePage from "@/components/site/SiteChrome";
import Link from "next/link";
export default function Page() {
  return (
    <GuidePage
      active="/fund"
      kicker="SOLANA / OSS FUNDING"
      title="How project funding works."
      description="Register a repository, verify ownership and sponsor community milestones."
    >
      <section className="ev-card">
        <h2>No coin required</h2>
        <p>
          Connect a Solana wallet on {solanaNetwork().cluster} and register your
          GitHub repository. The governance agent verifies ownership and the
          wallet binding before adoption.
        </p>
        <h2>Fund delivery</h2>
        <p>
          SOL sponsorships have a 24-hour refund window. Settled funds can be
          committed to owner-proposed, evidence-reviewed milestones approved by
          the governance quorum. Contributor work and declared owner payroll are
          both supported. Completed work requires a separate evidence review and
          two-day challenge period.
        </p>
        <p>
          Failed work keeps its budget and reopens for another community worker.
        </p>
        <Link className="ev-link" href="/docs/funding">
          Read the funding rules →
        </Link>
      </section>
    </GuidePage>
  );
}

import RehearsalDeposit from "@/components/governance/RehearsalDeposit";
import GuidePage from "@/components/site/SiteChrome";
import ReviewerProof from "@/components/governance/ReviewerProof";
import release from "@/docs/DAO_RELEASE_CANDIDATE.json";
import { reviewerContext } from "@/lib/governance/reviewer-proof.mjs";
export const metadata = {
  title: "Devnet reviewer verification · Evangel",
  robots: { index: false, follow: false },
  alternates: { canonical: "/governor/rehearsal" },
};
export default function RehearsalPage() {
  const context = reviewerContext(release);
  return (
    <GuidePage
      active="/governor"
      kicker="DEVNET REHEARSAL"
      title="Devnet governance rehearsal."
      description="Deposit your test voting tokens to start the rehearsal."
    >
      <RehearsalDeposit />
      <details className="ev-card">
        <summary>Wallet-control proof tools</summary>
        <ReviewerProof context={context} />
      </details>
      <section className="ev-card">
        <h2>What happens next</h2>
        <ol>
          <li>
            Switch your wallet to Solana Devnet, connect, and deposit the test
            voting balance.
          </li>
          <li>
            Wait seven days from the finalized deposit before creating a
            proposal that uses it.
          </li>
          <li>
            Review the exact upgrade, then rehearse the six-hour challenge and
            72-hour contested vote on the disposable target.
          </li>
        </ol>
        <p>
          Real-time tests must respect seven-day stake maturity, the six-hour
          challenge window and a 72-hour contested vote. A message signature
          does not complete these tests.
        </p>
        <p>
          Candidate:{" "}
          <a
            href={`https://explorer.solana.com/address/${context.program}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            Inspect deployed guard
          </a>
        </p>
        <p style={{ overflowWrap: "anywhere" }}>
          Reviewed binary SHA-256: {context.binarySha256}
        </p>
      </section>
    </GuidePage>
  );
}

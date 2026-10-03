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
      title="Verify your reviewer wallet."
      description="Confirm wallet control before the governance rehearsal."
    >
      <ReviewerProof context={context} />
      <section className="ev-card">
        <h2>What happens next</h2>
        <ol>
          <li>
            Each participant signs and sends their downloaded proof to the
            deployment operator.
          </li>
          <li>
            The operator verifies all proofs against the exact candidate before
            configuring the rehearsal.
          </li>
          <li>
            A separate Devnet target and dummy voting token are used to test
            governance. The existing factory remains under its current multisig.
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

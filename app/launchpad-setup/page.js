export const metadata = {
  alternates: { canonical: "/launchpad-setup" },
  openGraph: { url: "/launchpad-setup", siteName: "Evangel", type: "website" },
};
import GuidePage from "@/components/site/SiteChrome";
import Link from "next/link";
export default function Page() {
  return (
    <GuidePage
      active="/launch"
      kicker="SOLANA / LAUNCH GUIDE"
      title="Bring people around an idea."
      description="A native factory, fixed supply and milestones that reward work."
    >
      <section className="ev-card">
        <h2>Trading integration under verification</h2>
        <p>
          The target is 70% of a 21-million supply for liquidity without a seed
          e/acc deposit. Public launches remain disabled while trading
          infrastructure is checked against the governed reserve and exact fee
          rules. Network fees and account rent still apply.
        </p>
        <h2>A stake in doing the work</h2>
        <p>
          Verified adoption releases 1% upfront. The remaining 29% funds
          milestones: at most 20% total for the developer, at least 10% for
          workers, with a shared 1% release limit per rolling 21 days.
        </p>
        <Link className="ev-link" href="/docs/launching">
          Read the launch guide →
        </Link>
      </section>
    </GuidePage>
  );
}

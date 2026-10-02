import Link from "next/link";
import GuidePage from "@/components/site/SiteChrome";
import { EACC } from "@/lib/eacc/config.mjs";
export const metadata = {
  alternates: { canonical: "/eacc" },
  openGraph: { url: "/eacc", siteName: "Evangel", type: "website" },
  title: "e/acc & open source | Evangel",
};
export default function EaccPage() {
  return (
    <GuidePage
      active="/eacc"
      kicker="ACCELERATE THE WORK"
      title="One community. More builders."
      description="Every project pairs with e/acc. Trading funds the people building."
    >
      <section className="ev-card">
        <h2>5% on buys. 5% on sells.</h2>
        <div className="ev-proof-grid">
          {[
            ["2.55%", "Project development"],
            ["0.5%", "Community contributors"],
            ["0.8%", "Governance operations"],
            ["0.15%", "Foundation"],
            ["1%", "Venue protocol"],
          ].map(([rate, label]) => (
            <p key={label}>
              <strong>{rate}</strong>
              <span>{label}</span>
            </p>
          ))}
        </div>
        <p>
          Target shares of each trade’s value; venue integration is not yet
          enabled. Unused governance funding returns to the same project’s
          development treasury after each UTC day.
        </p>
      </section>
      <section className="ev-card">
        <h2>Paired with existing e/acc.</h2>
        <p>
          {EACC.chain} · Token-2022 · {EACC.decimals} decimals
        </p>
        <a
          className="ev-link ev-direct-address"
          href={EACC.explorer}
          target="_blank"
          rel="noreferrer"
        >
          {EACC.mint} ↗
        </a>
        <p>
          Buyers bring e/acc into the pool. Sellers receive e/acc from its
          available reserve. No buy-and-burn and no Evangel platform token.
        </p>
      </section>
      <section className="ev-card">
        <h2>Fund the work. Keep building.</h2>
        <p>
          Verified developers claim their project income directly. Contributor
          funding follows agreed milestones. Approved unpaid governance costs
          remain protected when daily surplus returns to development.
        </p>
        <p>
          Quote trading and settlement are tested locally with a dummy asset.
          Public launches remain disabled pending production venue and
          quote-mint verification.
        </p>
        <Link className="ev-link" href="/docs/fees">
          Explore the funding rules →
        </Link>
      </section>
    </GuidePage>
  );
}

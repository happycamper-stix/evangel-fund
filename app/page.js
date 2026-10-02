import { solanaNetwork } from "@/lib/solana/network.mjs";
export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", siteName: "Evangel", type: "website" },
};
import Link from "next/link";
import { redirect } from "next/navigation";
import "./landing.css";
function Signal() {
  return (
    <div className="signal-art" aria-hidden="true">
      <div className="broadcast-rings">
        <i />
        <i />
        <i />
      </div>
      <img
        className="broadcast-mark"
        src="/evangel-mark.svg"
        alt=""
        width="360"
        height="360"
      />
      <span className="broadcast-stamp">EVANGEL / SPREAD THE WORD</span>
      <span className="broadcast-index">SIGNAL NO. 001</span>
    </div>
  );
}
export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  if (typeof params?.project === "string" && params.project)
    redirect(`/launch?project=${encodeURIComponent(params.project)}`);
  return (
    <div className="landing">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="Evangel home">
          <img src="/evangel-mark.svg" alt="" width="38" height="38" />
          evangel
          <span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/launch">Launchpad</Link>
          <Link href="/fund">Fund open source</Link>
          <Link href="/eacc">e/acc</Link>
          <Link href="/docs">Docs ↗</Link>
        </nav>
        <Link className="landing-enter" href="/launch">
          Enter app <span>↗</span>
        </Link>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">
              <i /> IDEAS DESERVE EVANGELISTS
            </p>
            <h1>
              Spread the
              <br />
              <span>belief.</span>
            </h1>
            <p className="landing-intro">
              Rally around e/acc. Back open-source workers. Turn shared belief
              into work the world can build on.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary" href="/fund">
                Back a builder <span>↗</span>
              </Link>
              <Link className="landing-text-link" href="/launch">
                Explore the launchpad <span>→</span>
              </Link>
            </div>
            <p className="landing-status">
              <span /> Solana {solanaNetwork().cluster} · Launches coming soon
            </p>
          </div>
          <Signal />
        </section>
        <section className="landing-statement" aria-label="Our idea">
          <p className="landing-eyebrow">FROM FOLLOWERS TO FOUNDERS</p>
          <h2>
            Don’t just follow.
            <br />
            <span>Give it a following.</span>
          </h2>
          <p>
            A stake for creators. Rewards for contributors.
            <br />
            An economy for the people who show up.
          </p>
        </section>
        <section className="landing-paths" aria-label="Explore Evangel">
          <Link href="/launch" className="landing-path">
            <span className="path-number">01 / LAUNCH</span>
            <span className="path-arrow" aria-hidden="true">
              ↗
            </span>
            <h3>Rally your people.</h3>
            <p>Launch around an idea worth spreading.</p>
            <div className="path-tags">
              <span>Posts</span>
              <span>Repos</span>
              <span>Creators</span>
            </div>
          </Link>
          <Link href="/fund" className="landing-path">
            <span className="path-number">02 / FUND</span>
            <span className="path-arrow" aria-hidden="true">
              ↗
            </span>
            <h3>Back what comes next.</h3>
            <p>Support the open-source work you want to exist.</p>
            <div className="path-tags">
              <span>Open source</span>
              <span>Contributors</span>
              <span>Bounties</span>
            </div>
          </Link>
        </section>
        <section className="landing-closing">
          <span className="landing-eyebrow">FOR THE BUILDERS</span>
          <h2>e/acc × OSS</h2>
          <p>
            An existing community. More ways to support the people doing the
            work.
          </p>
          <Link className="landing-text-link" href="/eacc">
            Explore the model <span>↗</span>
          </Link>
          <span className="closing-status">NO EVANGEL PLATFORM TOKEN</span>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="landing-brand" href="/">
          evangel.
        </Link>
        <span>Ideas spread through people.</span>
        <nav aria-label="Resources">
          <Link href="/docs">Docs</Link>
          <Link href="/governor">Governor status</Link>
          <Link href="/setup">Funding guide</Link>
        </nav>
      </footer>
    </div>
  );
}

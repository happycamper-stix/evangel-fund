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
    </div>
  );
}
export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  if (typeof params?.project === "string" && params.project)
    redirect(`/launch?project=${encodeURIComponent(params.project)}`);
  return (
    <div className="landing landing-minimal">
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
          <Link href="/launch">Accelerate</Link>
          <Link href="/fund">Fund projects</Link>
          <Link href="/eacc">How it works</Link>
          <Link href="/docs">Docs ↗</Link>
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">
              <i /> E/ACC × OPEN SOURCE
            </p>
            <h1>
              Spread
              <br />
              <span>progress.</span>
            </h1>
            <p className="landing-intro">
              A gathering place for people building what’s next.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary" href="/fund">
                Explore projects <span>↗</span>
              </Link>
            </div>
            <p className="landing-status">
              <span /> Solana {solanaNetwork().cluster} · Test assets only
            </p>
          </div>
          <Signal />
        </section>
        <section className="landing-doors" aria-label="Explore Evangel">
          <Link href="/launch"><span>TOKENS</span><h2>Accelerate. <b aria-hidden="true">↗</b></h2></Link>
          <Link href="/fund"><span>PROJECT FUNDING</span><h2>Fund open-source work. <b aria-hidden="true">↗</b></h2></Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="landing-brand" href="/">
          evangel.
        </Link>
        <span>Ideas spread through people.</span>
        <nav aria-label="Resources">
          <Link href="/docs">Docs</Link>
          <Link href="/governor">Governance status</Link>
          <Link href="/setup">Funding guide</Link>
        </nav>
      </footer>
    </div>
  );
}

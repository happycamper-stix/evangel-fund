import { solanaNetwork } from "@/lib/solana/network.mjs";
import Link from "next/link";

export function SiteLinks({ active }) {
  return (
    <nav className="site-links" aria-label="Main navigation">
      {[
        ["/launch", "Launchpad"],
        ["/fund", "Fund open source"],
        ["/eacc", "e/acc"],
        ["/governor", "Governor"],
        ["/docs", "Docs"],
        ["/verify", "Verify"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function SiteHeader({ active }) {
  return (
    <>
      <a className="ev-skip" href="#page-main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="site-brand" href="/" aria-label="Evangel home">
          <img src="/evangel-mark.svg" alt="" width="37" height="39" />
          evangel
        </Link>
        <SiteLinks active={active} />
        <span className="site-network">
          <i />
          Solana · {solanaNetwork().cluster}
        </span>
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>evangel / ideas spread through people</span>
      <nav aria-label="Resources">
        <Link href="/docs">Documentation</Link>
        <Link href="/setup">Funding guide</Link>
        <Link href="/governor">Governor status</Link>
      </nav>
      <small>
        {solanaNetwork().cluster} · Token launches and funding require a
        deployed Solana program.
      </small>
    </footer>
  );
}
export default function GuidePage({
  active,
  kicker,
  title,
  description,
  children,
}) {
  return (
    <div className="ev-app">
      <SiteHeader active={active} />
      <main id="page-main" className="site-guide">
        <header className="site-guide-intro">
          <p className="ev-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        <div className="ev-stack">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

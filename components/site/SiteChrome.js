import { solanaNetwork } from "@/lib/solana/network.mjs";
import Link from "next/link";

export function SiteLinks({ active }) {
  return (
    <nav className="site-links" aria-label="Main navigation">
      {[
        ["/launch", "Accelerate"],
        ["/fund", "Fund projects"],
        ["/eacc", "How it works"],
        ["/governor", "Governance"],
        ["/docs", "Docs"],
        ["/verify", "Verify GitHub"],
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
          evangel<span className="site-acc-mark">e/acc</span>
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
      <span>evangel / build it. back it. spread it.</span>
      <nav aria-label="Resources">
        <Link href="/docs">Documentation</Link>
        <Link href="/setup">Funding guide</Link>
        <Link href="/governor">Governance status</Link>
      </nav>
      <small>
        {solanaNetwork().cluster} pilot · Test assets only · Public trading not
        enabled.
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

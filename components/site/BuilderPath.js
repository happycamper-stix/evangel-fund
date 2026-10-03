import Link from "next/link";
export default function BuilderPath({ active }) {
  return (
    <nav className="builder-path" aria-label="Builder journey">
      {[
        ["/verify", "01", "Establish your identity", "Connect GitHub + wallet"],
        [
          "/fund",
          "02",
          "Fund open-source work",
          "Back a repo. Reward delivery.",
        ],
        ["/launch", "03", "Rally a community", "Explore e/acc-paired launches"],
      ].map(([href, n, title, detail]) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "step" : undefined}
        >
          <span className="builder-step">{n} /</span>
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
      ))}
    </nav>
  );
}

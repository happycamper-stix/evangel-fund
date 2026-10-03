import Link from "next/link";
export default function BuilderPath({ active }) {
  return (
    <nav className="builder-path" aria-label="Choose what to do">
      {[
        ["/verify", "Verify your GitHub role", "For repository owners and contributors"],
        [
          "/fund",
          "Fund a project",
          "Browse repositories and support their work",
        ],
        ["/launch", "Explore token launches", "View community tokens and launch availability"],
      ].map(([href, title, detail]) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
        >
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

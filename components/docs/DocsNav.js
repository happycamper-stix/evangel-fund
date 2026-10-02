"use client";
import Link from "next/link";
import { useState } from "react";
export default function DocsNav({ pages, active }) {
  const [query, setQuery] = useState("");
  const matches = pages.filter((p) =>
    (p.title + " " + p.summary + " " + p.keywords)
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <aside className="docs-sidebar">
      <p className="ev-kicker">THE FIELD GUIDE</p>
      <label className="ev-field">
        Search documentation
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Vesting, pairings, keys…"
        />
      </label>
      <nav aria-label="Documentation chapters">
        {matches.map((p, i) => (
          <Link
            href={p.slug === "overview" ? "/docs" : `/docs/${p.slug}`}
            key={p.slug}
            aria-current={p.slug === active ? "page" : undefined}
          >
            <span>{String(p.order + 1).padStart(2, "0")}</span>
            {p.title}
          </Link>
        ))}
      </nav>
      <p role="status" className="docs-search-status">
        {query && `${matches.length} matching chapters`}
      </p>
      <small>
        Solana · Testnet
        <br />
        Updated September 30, 2026
      </small>
    </aside>
  );
}

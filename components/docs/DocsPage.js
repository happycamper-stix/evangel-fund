import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site/SiteChrome";
import DocsNav from "./DocsNav";
import pages from "@/lib/docs/content.json";
import "./docs.css";
const sectionId = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export default function DocsPage({ slug = "overview" }) {
  const index = pages.findIndex((p) => p.slug === slug),
    page = pages[index];
  const nav = pages.map((p, order) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    keywords: p.sections
      .map((s) => s.title + " " + s.paragraphs.join(" "))
      .join(" "),
    order,
  }));
  return (
    <div className="ev-app docs-app">
      <SiteHeader active="/docs" />
      <main id="page-main" className="docs-layout">
        <DocsNav pages={nav} active={slug} />
        <article className="docs-article">
          <header className="docs-intro">
            <p className="ev-kicker">
              EVANGEL DOCUMENTATION / {String(index + 1).padStart(2, "0")}
            </p>
            <h1>{page.title}</h1>
            <p>{page.summary}</p>
          </header>
          <nav className="docs-toc" aria-label="On this page">
            <strong>In this chapter</strong>
            {page.sections.map((s) => (
              <a key={s.title} href={`#${sectionId(s.title)}`}>
                {s.title} <span aria-hidden="true">↘</span>
              </a>
            ))}
          </nav>
          {page.sections.map((section) => (
            <section
              className="docs-section"
              key={section.title}
              id={sectionId(section.title)}
            >
              <h2>{section.title}</h2>
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {section.table && (
                <div
                  className="docs-table"
                  role="region"
                  aria-label={section.title + " reference table"}
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        {section.table[0].map((h) => (
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.slice(1).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.links && (
                <ul>
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {link.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.code && (
                <pre tabIndex={0} aria-label={section.title + " code example"}>
                  <code>{section.code}</code>
                </pre>
              )}
            </section>
          ))}
          <nav className="docs-pagination" aria-label="Adjacent chapters">
            {index > 0 && (
              <Link
                href={
                  pages[index - 1].slug === "overview"
                    ? "/docs"
                    : `/docs/${pages[index - 1].slug}`
                }
              >
                <small>← PREVIOUS</small>
                {pages[index - 1].title}
              </Link>
            )}
            {index < pages.length - 1 && (
              <Link href={`/docs/${pages[index + 1].slug}`}>
                <small>NEXT →</small>
                {pages[index + 1].title}
              </Link>
            )}
          </nav>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

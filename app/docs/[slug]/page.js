import { notFound } from "next/navigation";
import DocsPage from "@/components/docs/DocsPage";
import pages from "@/lib/docs/content.json";
export const dynamicParams = false;
export function generateStaticParams() {
  return pages.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = pages.find((p) => p.slug === slug);
  return {
    alternates: { canonical: `/docs/${slug}` },
    openGraph: { url: `/docs/${slug}`, siteName: "Evangel", type: "article" },
    title: p ? `${p.title} — Evangel docs` : "Documentation — Evangel",
    description: p?.summary,
  };
}
export default async function Page({ params }) {
  const { slug } = await params;
  if (!pages.some((p) => p.slug === slug)) notFound();
  return <DocsPage slug={slug} />;
}

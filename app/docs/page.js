import DocsPage from "@/components/docs/DocsPage";
export const metadata = {
  alternates: { canonical: "/docs" },
  openGraph: { url: "/docs", siteName: "Evangel", type: "website" },
  title: "Documentation — Evangel",
  description:
    "The complete Evangel guide: social launches, tokenomics, governance, pairing assets, funding, and deployment.",
};
export default function Page() {
  return <DocsPage />;
}

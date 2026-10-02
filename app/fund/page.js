export const metadata = {
  alternates: { canonical: "/fund" },
  openGraph: { url: "/fund", siteName: "Evangel", type: "website" },
};
import Platform from "@/components/solana/Platform";
import { solanaConfig } from "@/lib/solana/config.mjs";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Platform mode="fund" config={solanaConfig()} />;
}

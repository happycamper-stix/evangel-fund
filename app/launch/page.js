export const metadata = {
  alternates: { canonical: "/launch" },
  openGraph: { url: "/launch", siteName: "Evangel", type: "website" },
};
import Platform from "@/components/solana/Platform";
import { solanaConfig } from "@/lib/solana/config.mjs";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Platform mode="launch" config={solanaConfig()} />;
}

import { ClerkProvider } from "@clerk/nextjs";
import GuidePage from "@/components/site/SiteChrome";
import Verification from "@/components/identity/Verification";
export const metadata = {
  title: "Verify your identity | Evangel",
  alternates: { canonical: "/verify" },
};
export default function Page() {
  const ready =
    process.env.VERCEL_ENV !== "production" ||
    process.env.CLERK_SECRET_KEY?.startsWith("sk_live_");
  return (
    <GuidePage
      active="/verify"
      kicker="Identity / provenance"
      title="Verify your GitHub role."
      description="Connect GitHub and your Solana wallet. Verify your role in the repositories you build."
    >
      {ready ? (
        <ClerkProvider>
          <Verification />
        </ClerkProvider>
      ) : (
        <p>
          Identity verification is awaiting production sign-in configuration.
          Repository claims and identity-dependent governance approvals remain
          unavailable until setup is complete.
        </p>
      )}
    </GuidePage>
  );
}

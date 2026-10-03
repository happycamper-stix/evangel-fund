import { LEGACY_UPGRADE_HOLD } from "@/lib/governance/dao-policy.mjs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    { error: LEGACY_UPGRADE_HOLD, status: "governance-migration-required" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

import { feeDayDust } from "./fee-policy.mjs";
// A deterministic public plan. No key, RPC endpoint or signing material belongs here.
export function dailySettlementPlan(snapshot, nowSeconds) {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0)
    throw Error("Invalid settlement clock");
  const today = BigInt(Math.floor(nowSeconds / 86400));
  return (snapshot.feeDays || [])
    .filter((d) => BigInt(d.day) < today)
    .map((d) => {
      const project = snapshot.projects.find((p) => p.address === d.project);
      if (!project) throw Error("Fee day has no originating project");
      const fees = BigInt(d.fees);
      const dust = feeDayDust(fees, d.policy);
      const surplus = d.settled ? 0n : BigInt(d.governance) + dust;
      return {
        project: d.project,
        feeDay: d.address,
        day: d.day,
        settle: !d.settled,
        developmentRecipient: project.adopted ? project.owner : null,
        developmentClaim: (project.adopted
          ? BigInt(d.development) + surplus
          : 0n
        ).toString(),
        reservedExpenses: d.expenseCommitted,
      };
    })
    .filter((p) => p.settle || BigInt(p.developmentClaim) > 0n);
}

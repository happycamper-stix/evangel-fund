export function milestoneDocument(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error("Milestone document must be valid JSON");
  }
  for (const key of [
    "objective",
    "acceptanceCriteria",
    "ossImpact",
    "evidenceRequired",
  ])
    if (
      typeof value?.[key] !== "string" ||
      !value[key].trim() ||
      new TextEncoder().encode(value[key]).length > 2500
    )
      throw Error(`Invalid milestone ${key}`);
  return value;
}
export function approvalAllowed(decision, verification) {
  return Boolean(
    decision?.verdict === "approve" &&
    Number.isInteger(decision.confidence) &&
    decision.confidence >= 80 &&
    decision.confidence <= 100 &&
    decision.conflict === false &&
    typeof decision.reasoning === "string" &&
    decision.reasoning.trim() &&
    new TextEncoder().encode(decision.reasoning).length <= 4096 &&
    Array.isArray(decision.citations) &&
    decision.citations.length > 0 &&
    decision.citations.length <= 30 &&
    decision.citations.every(
      (i) => Number.isInteger(i) && verification[i]?.verified,
    ),
  );
}

export async function invoiceIdentity(record) {
  for (const key of ["provider", "invoiceId", "period", "amountQuoteUnits"]) {
    if (
      typeof record?.[key] !== "string" ||
      !record[key].trim() ||
      record[key].length > 256
    )
      throw Error(`Invalid invoice ${key}`);
  }
  if (
    !["inference", "api"].includes(record.category) ||
    !/^\d+$/.test(record.amountQuoteUnits) ||
    BigInt(record.amountQuoteUnits) <= 0n
  )
    throw Error("Invalid invoice category or amount");
  const identity = JSON.stringify({
    provider: record.provider.trim().toLowerCase(),
    invoiceId: record.invoiceId.trim().toLowerCase(),
  });
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

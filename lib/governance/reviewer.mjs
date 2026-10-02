import { address } from "@solana/kit";
import { GOVERNANCE_ACTIONS } from "./policy.mjs";
import { governedInstruction } from "../solana/program.mjs";
import { solanaNetwork } from "../solana/network.mjs";
// This checks structure and deployment binding, not the truth of an agent report.
export function reviewedInstruction(
  action,
  snapshot,
  { now = Date.now(), creating = false } = {},
) {
  const { factory, governance, config } = snapshot;
  if (!factory || !governance || !config?.configured)
    throw Error("Verified deployment unavailable.");
  if (
    action?.version !== 3 ||
    action.cluster !== config.cluster ||
    action.genesis !== solanaNetwork(config.cluster).genesis
  )
    throw Error(
      "Action belongs to a different network or an unsupported format.",
    );
  if (
    action.program !== config.program ||
    action.multisig !== governance.address ||
    action.authority !== factory.authority ||
    factory.authority !== governance.vault
  )
    throw Error(
      "Action does not match the deployed factory and governance vault.",
    );
  if (
    !GOVERNANCE_ACTIONS.includes(action.action) ||
    !action.args ||
    typeof action.args !== "object" ||
    Array.isArray(action.args)
  )
    throw Error("Unsupported governance action.");
  if (
    !/^[a-f0-9]{64}$/.test(action.reportHash || "") ||
    action.args.report !== action.reportHash
  )
    throw Error("Report hash mismatch.");
  if (
    !Array.isArray(action.accounts) ||
    action.accounts.length < 1 ||
    action.accounts.length > 20
  )
    throw Error("Invalid action accounts.");
  action.accounts.forEach(address);
  if (action.accounts.at(-1) !== governance.address)
    throw Error(
      "Action must end with the configured governance multisig account.",
    );
  for (const v of Object.values(action.args))
    if (typeof v === "number" && !Number.isSafeInteger(v))
      throw Error(
        "Numeric arguments must be safe integers; use decimal strings for large amounts.",
      );
  if (
    !Number.isSafeInteger(action.executionExpiresAt) ||
    action.executionExpiresAt <= Math.floor(now / 1000) ||
    action.executionExpiresAt > Math.floor(now / 1000) + 7 * 86400
  )
    throw Error("Invalid or expired execution window.");
  if (
    creating &&
    (!Number.isSafeInteger(action.expiresAt) ||
      action.expiresAt < now ||
      action.expiresAt > now + 300000 ||
      action.executionExpiresAt <= Math.floor(now / 1000) + governance.timeLock)
  )
    throw Error(
      "Obtain a fresh governor verification with enough time for the quorum delay.",
    );
  return governedInstruction(
    config.program,
    action.action,
    action.args,
    [governance.vault, factory.address, ...action.accounts],
    BigInt(action.executionExpiresAt),
  );
}
export function reviewerMember(snapshot, wallet) {
  if (
    !snapshot.governance?.members.some(
      (m) => m.address === wallet && m.permissions === 7,
    )
  )
    throw Error("Connect one of the configured reviewer wallets.");
  return wallet;
}

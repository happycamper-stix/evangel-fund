import { verifyProgramBytes } from "./program-integrity.mjs";
// Read-only preflight. Expected values must come from the reviewed release manifest,
// never from URL parameters, token metadata, or values supplied by a wallet.
export function assertDaoPublicRelease({
  bytes,
  manifest,
  state,
  expected,
  immutable,
  targetAuthority,
  guardAuthority,
}) {
  if (manifest?.developmentOnly !== false)
    throw Error("Development guard cannot control a public release");
  verifyProgramBytes(bytes, manifest);
  if (!immutable) throw Error("Guard must be immutable");
  if (
    !expected?.mint ||
    !expected?.developer ||
    !expected?.target ||
    !expected?.treasury ||
    expected.reviewers?.length !== 3
  )
    throw Error(
      "Voting mint, target, treasury, proposer and three reviewers must be confirmed",
    );
  if (state?.tag !== 1 || state.developmentUntil !== "0")
    throw Error("Explicit irreversible public transition required");
  for (const field of ["mint", "developer", "target", "treasury"])
    if (state[field] !== expected[field])
      throw Error(`Unexpected DAO ${field}`);
  if (
    state.reviewers.some((key, i) => key !== expected.reviewers[i]) ||
    new Set(state.reviewers).size !== 3 ||
    state.reviewers.includes(state.developer)
  )
    throw Error("Reviewer configuration mismatch");
  if (BigInt(state.supply) <= 0n) throw Error("Invalid governing supply");
  if (!guardAuthority || targetAuthority !== guardAuthority)
    throw Error("Target authority has not migrated to the guard");
  return true;
}

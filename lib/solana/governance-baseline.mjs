export function governanceDrift(current, baseline, program) {
  if (
    !baseline ||
    baseline.program !== program ||
    baseline.upgradeTransferPending ||
    !baseline.governanceBaseline
  )
    return ["Missing finalized deployment-approved governance baseline"];
  const expected = baseline.governanceBaseline;
  const fields = [
    "address",
    "vault",
    "threshold",
    "timeLock",
    "configAuthority",
  ];
  const changes = fields
    .filter((key) => current[key] !== expected[key])
    .map((key) => `Governance ${key} changed`);
  const members = (s) =>
    JSON.stringify(
      s.members
        .map((m) => ({ address: m.address, permissions: m.permissions }))
        .sort((a, b) => a.address.localeCompare(b.address)),
    );
  if (
    !Array.isArray(expected.members) ||
    members(current) !== members(expected)
  )
    changes.push("Governance member set or permissions changed");
  return changes;
}

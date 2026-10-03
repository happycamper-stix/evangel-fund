import { address, getAddressDecoder } from "@solana/kit";
import { LOADER, pda, pub } from "./program.mjs";
import { daoAddress, daoAuthority, decodeDao } from "./dao.mjs";
import { inspectDaoMint } from "./dao-mint.mjs";
import { assertDaoPublicRelease } from "./dao-release.mjs";
import { solanaNetwork } from "./network.mjs";
// Read-only Devnet/testnet gate. Manifest must be a reviewed local release file.
export async function inspectLiveDaoRelease({ rpc, release }) {
  const network = solanaNetwork(release.cluster);
  const expected = release.expected;
  if (!expected || expected.reviewers?.length !== 3)
    throw Error("Confirmed release identities required");
  for (const key of [
    release.program,
    expected.target,
    expected.mint,
    expected.developer,
    expected.treasury,
    ...expected.reviewers,
  ])
    address(key);
  if (!/^[1-9][0-9]*$/.test(release.supply || ""))
    throw Error("Reviewed fixed supply required");
  if ((await rpc("getGenesisHash", [])) !== network.genesis)
    throw Error("Wrong network");
  const config = await daoAddress(release.program, expected.target);
  const authority = await daoAuthority(release.program, config);
  const programData = await pda(LOADER, pub(release.program));
  const targetData = await pda(LOADER, pub(expected.target));
  const result = await rpc("getMultipleAccounts", [
    [
      release.program,
      programData,
      expected.target,
      targetData,
      config,
      expected.mint,
    ],
    { encoding: "base64", commitment: "finalized" },
  ]);
  if (
    !Number.isSafeInteger(result?.context?.slot) ||
    result?.value?.length !== 6
  )
    throw Error("Incomplete RPC observation");
  const accounts = result.value.map((a) => {
    if (!a || !Array.isArray(a.data) || a.data[1] !== "base64")
      throw Error("Release account missing");
    return { ...a, data: Buffer.from(a.data[0], "base64") };
  });
  const [program, guardData, target, td, ca, mint] = accounts;
  const key = (b) => getAddressDecoder().decode(b);
  for (const [account, dataAddress] of [
    [program, programData],
    [target, targetData],
  ]) {
    if (
      account.owner !== LOADER ||
      !account.executable ||
      account.data.length !== 36 ||
      account.data.readUInt32LE(0) !== 2 ||
      key(account.data.subarray(4, 36)) !== dataAddress
    )
      throw Error("Program identity mismatch");
  }
  for (const account of [guardData, td]) {
    if (
      account.owner !== LOADER ||
      account.executable !== false ||
      account.data.length < 45 ||
      account.data.readUInt32LE(0) !== 3
    )
      throw Error("Invalid loader data");
  }
  if (ca.owner !== release.program || ca.executable !== false)
    throw Error("Invalid configuration owner");
  const state = decodeDao(ca.data);
  if (state.supply !== release.supply)
    throw Error("Fixed voting supply differs from reviewed denominator");
  const inspection = inspectDaoMint(mint, expected.mint);
  if (!inspection.compatible) throw Error(inspection.reasons.join("; "));
  // Burns are allowed; inflation above the fixed denominator is not.
  if (BigInt(inspection.supply) > BigInt(release.supply))
    throw Error("Mint supply exceeds fixed voting denominator");
  assertDaoPublicRelease({
    bytes: guardData.data.subarray(45),
    manifest: release.production,
    state,
    expected,
    immutable: guardData.data[12] === 0,
    targetAuthority: td.data[12] === 1 ? key(td.data.subarray(13, 45)) : null,
    guardAuthority: authority,
  });
  return {
    cluster: network.cluster,
    slot: result.context.slot,
    config,
    authority,
    state,
    mint: inspection,
    status: "verified",
    limitation:
      "Verifies current accounts, not reviewer independence, participation, or inspection quality",
  };
}

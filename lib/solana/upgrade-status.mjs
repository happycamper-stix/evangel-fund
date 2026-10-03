import { getAddressDecoder } from "@solana/kit";
import { verifyProgramBytes } from "./program-integrity.mjs";
import { LOADER, pda, pub } from "./program.mjs";
import { decodeMultisig, assertSafeMultisig } from "./squads.mjs";
import { governanceDrift } from "./governance-baseline.mjs";
import { upgradeActions } from "./upgrade-plan.mjs";
import { solanaNetwork } from "./network.mjs";

export function validateUpgradeAccounts({
  program,
  programData,
  buffer,
  baseline,
  candidate,
  prepared,
}) {
  const decode = (b) => getAddressDecoder().decode(b);
  if (
    !program?.executable ||
    program.owner !== LOADER ||
    program.data.length !== 36 ||
    program.data.readUInt32LE(0) !== 2 ||
    decode(program.data.subarray(4)) !== prepared.programData
  )
    throw Error("Program identity changed");
  if (
    programData?.owner !== LOADER ||
    programData.data.length < 45 ||
    programData.data.readUInt32LE(0) !== 3 ||
    programData.data[12] !== 1 ||
    decode(programData.data.subarray(13, 45)) !== baseline.authority
  )
    throw Error("Upgrade authority changed");
  try {
    verifyProgramBytes(programData.data.subarray(45), candidate);
    return "deployed";
  } catch {}
  verifyProgramBytes(programData.data.subarray(45), baseline);
  if (programData.data.length < 45 + candidate.binaryLength)
    throw Error("Program capacity is insufficient");
  if (
    buffer?.owner !== LOADER ||
    buffer.data.length !== 37 + candidate.binaryLength ||
    buffer.data.readUInt32LE(0) !== 1 ||
    buffer.data[4] !== 1 ||
    decode(buffer.data.subarray(5, 37)) !== baseline.authority
  )
    throw Error("Upgrade buffer authority changed or buffer missing");
  verifyProgramBytes(buffer.data.subarray(37), candidate);
  return "ready";
}
export async function upgradeStatus({
  rpc,
  config,
  baseline,
  candidate,
  prepared,
}) {
  if (
    !config.configured ||
    config.cluster !== "devnet" ||
    baseline.cluster !== "devnet" ||
    prepared.cluster !== "devnet" ||
    config.program !== baseline.program ||
    prepared.program !== baseline.program ||
    config.governanceMultisig !== baseline.governanceMultisig ||
    prepared.multisig !== baseline.governanceMultisig ||
    prepared.vault !== baseline.authority ||
    candidate.binarySha256 !== prepared.binarySha256 ||
    candidate.binaryLength !== prepared.binaryLength ||
    candidate.venueAdapter !== true ||
    candidate.venueCandidate !== false ||
    candidate.testFixtures !== false
  )
    throw Error("Upgrade is not bound to this deployment");
  if ((await rpc("getGenesisHash")) !== solanaNetwork("devnet").genesis)
    throw Error("Wrong network");
  const programData = await pda(LOADER, pub(baseline.program));
  if (programData !== prepared.programData)
    throw Error("Wrong program data address");
  const result = await rpc("getMultipleAccounts", [
    [
      baseline.program,
      programData,
      prepared.buffer,
      baseline.governanceMultisig,
    ],
    { encoding: "base64", commitment: "finalized" },
  ]);
  const [program, data, buffer, multisig] = result.value.map(
    (a) => a && { ...a, data: Buffer.from(a.data[0], "base64") },
  );
  if (!multisig) throw Error("Governance missing");
  const governance = assertSafeMultisig(
    await decodeMultisig(baseline.governanceMultisig, multisig),
  );
  if (governanceDrift(governance, baseline, baseline.program).length)
    throw Error("Governance changed");
  const status = validateUpgradeAccounts({
    program,
    programData: data,
    buffer,
    baseline,
    candidate,
    prepared,
  });
  return {
    status,
    cluster: "devnet",
    slot: result.context.slot,
    program: baseline.program,
    programData,
    buffer: prepared.buffer,
    binarySha256: candidate.binarySha256,
    binaryLength: candidate.binaryLength,
    governance,
    instruction:
      status === "ready"
        ? upgradeActions({
            program: baseline.program,
            programData,
            buffer: prepared.buffer,
            authority: governance.vault,
            refundRecipient: prepared.refundRecipient,
            additionalBytes: 0,
          }).map(({ data, ...ix }) => ({
            ...ix,
            dataHex: Buffer.from(data).toString("hex"),
          }))[0]
        : null,
  };
}

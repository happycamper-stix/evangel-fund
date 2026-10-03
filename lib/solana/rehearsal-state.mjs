import { getAddressDecoder } from "@solana/kit";
import { inspectLiveDaoRelease } from "./dao-live-release.mjs";
import { daoStake, decodeDao } from "./dao.mjs";
import { rehearsalTokenAccount } from "./rehearsal-setup.mjs";
import { TOKEN } from "./program.mjs";
export async function rehearsalState({ rpc, release, owner }) {
  if (
    release.cluster !== "devnet" ||
    release.disposable !== true ||
    release.publicActivation !== false
  )
    throw Error("Not a disposable Devnet rehearsal");
  const participants = [
    release.expected.developer,
    ...release.expected.reviewers,
  ];
  if (owner && !participants.includes(owner))
    throw Error("Not a configured participant");
  const verified = await inspectLiveDaoRelease({ rpc, release });
  const result = {
    configured: true,
    cluster: "devnet",
    program: release.program,
    target: release.expected.target,
    mint: release.expected.mint,
    config: verified.config,
    participants,
    slot: verified.slot,
    supply: release.supply,
    disposable: true,
  };
  if (!owner) return result;
  const tokenAccount = await rehearsalTokenAccount(
      release.expected.mint,
      owner,
    ),
    stakeAddress = await daoStake(release.program, verified.config, owner);
  const observed = await rpc("getMultipleAccounts", [
    [tokenAccount, stakeAddress],
    {
      encoding: "base64",
      commitment: "finalized",
      minContextSlot: verified.slot,
    },
  ]);
  const [ta, sa] = observed.value;
  const td = ta && Buffer.from(ta.data[0], "base64"),
    key = (b) => getAddressDecoder().decode(b);
  if (
    !td ||
    ta.owner !== TOKEN ||
    ta.executable ||
    (td.length !== 165 &&
      !(
        td.length === 170 &&
        td.subarray(165).equals(Buffer.from([2, 7, 0, 0, 0]))
      )) ||
    td.readUInt32LE(72) !== 0 ||
    td.readUInt32LE(109) !== 0 ||
    td.readUInt32LE(129) !== 0 ||
    key(td.subarray(0, 32)) !== release.expected.mint ||
    key(td.subarray(32, 64)) !== owner ||
    td[108] !== 1
  )
    throw Error("Unexpected participant token account");
  let stake = null;
  if (sa) {
    if (sa.owner !== release.program || sa.executable)
      throw Error("Unexpected stake owner");
    stake = decodeDao(Buffer.from(sa.data[0], "base64"));
    if (
      stake.tag !== 2 ||
      stake.config !== verified.config ||
      stake.owner !== owner
    )
      throw Error("Wrong stake account");
  }
  return {
    ...result,
    owner,
    tokenAccount,
    walletAmount: td.readBigUInt64LE(64).toString(),
    stakeAmount: stake?.amount || "0",
    deposited: stake?.deposited || "0",
    lockedUntil: stake?.lockedUntil || "0",
    matureAt:
      stake && BigInt(stake.amount) > 0n
        ? (BigInt(stake.deposited) + 604800n).toString()
        : null,
  };
}

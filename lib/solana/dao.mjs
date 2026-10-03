import { getAddressDecoder } from "@solana/kit";
import { concat, integer, pub, pda, hashBytes } from "./program.mjs";
const fields = {
  initialize: [
    ["developer", "pub"],
    ["reviewers", "reviewers"],
    ["treasury", "pub"],
  ],
  deposit: [["amount", "u64"]],
  withdraw: [],
  propose: [
    ["code", "hash"],
    ["review", "hash"],
    ["uri", "str"],
  ],
  attest: [],
  challenge: [["evidence", "hash"]],
  vote: [["approve", "bool"]],
  finalize: [],
  cancel: [],
  execute: [],
};
export function daoAction(name, args = {}) {
  if (!Object.hasOwn(fields, name)) throw Error("Unknown DAO action");
  return concat([
    Uint8Array.of(Object.keys(fields).indexOf(name)),
    ...fields[name].map(([key, type]) => {
      const value = args[key];
      if (type === "pub") return pub(value);
      if (type === "reviewers") {
        if (!Array.isArray(value) || value.length !== 3)
          throw Error("Three reviewers required");
        return concat(value.map(pub));
      }
      if (type === "hash") return hashBytes(value);
      if (type === "u64") return integer(value);
      if (type === "bool") {
        if (typeof value !== "boolean") throw Error("Boolean required");
        return Uint8Array.of(Number(value));
      }
      if (typeof value !== "string" || !value.startsWith("https://"))
        throw Error("Public HTTPS evidence URL required");
      const bytes = new TextEncoder().encode(value);
      if (bytes.length > 200) throw Error("Evidence URL exceeds 200 bytes");
      return concat([integer(bytes.length, 4), bytes]);
    }),
  ]);
}
export function daoInstruction(programAddress, name, args, accounts) {
  return { programAddress, data: daoAction(name, args), accounts };
}
export const daoAddress = (program, target) => pda(program, "dao", pub(target));
export const daoAuthority = (program, config) =>
  pda(program, "authority", pub(config));
export const daoProposal = (program, config, nonce) =>
  pda(program, "proposal", pub(config), integer(nonce));
export const daoStake = (program, config, owner) =>
  pda(program, "stake", pub(config), pub(owner));
export const daoEscrow = (program, config, owner) =>
  pda(program, "escrow", pub(config), pub(owner));
export const daoBallot = (program, proposal, owner) =>
  pda(program, "ballot", pub(proposal), pub(owner));
export function decodeDao(bytes) {
  const b = Buffer.from(bytes);
  let o = 0;
  const take = (n) => {
    if (o + n > b.length) throw Error("Truncated DAO account");
    const v = b.subarray(o, o + n);
    o += n;
    return v;
  };
  const u8 = () => take(1)[0],
    u64 = () => take(8).readBigUInt64LE().toString(),
    i64 = () => take(8).readBigInt64LE().toString();
  const key = () => getAddressDecoder().decode(take(32)),
    hash = () => take(32).toString("hex"),
    str = () => take(take(4).readUInt32LE()).toString("utf8");
  const tag = u8();
  if (tag === 1)
    return {
      tag,
      developer: key(),
      target: key(),
      mint: key(),
      supply: u64(),
      reviewers: [key(), key(), key()],
      treasury: key(),
      nonce: u64(),
      generation: u64(),
    };
  if (tag === 2)
    return {
      tag,
      config: key(),
      owner: key(),
      amount: u64(),
      deposited: i64(),
      lockedUntil: i64(),
    };
  if (tag === 3)
    return {
      tag,
      config: key(),
      nonce: u64(),
      buffer: key(),
      code: hash(),
      base: hash(),
      generation: u64(),
      review: hash(),
      uri: str(),
      created: i64(),
      opened: i64(),
      approvals: u8(),
      challenges: u64(),
      yes: u64(),
      no: u64(),
      status: u8(),
    };
  if (tag === 4)
    return {
      tag,
      proposal: key(),
      voter: key(),
      challenged: !!u8(),
      voted: !!u8(),
      evidence: hash(),
    };
  throw Error("Unknown DAO account tag");
}

// Proposal and execution hash both the staged and current binaries onchain.
export function daoComputeBudget() {
  return {
    programAddress: "ComputeBudget111111111111111111111111111111",
    accounts: [],
    data: concat([Uint8Array.of(2), integer(600000, 4)]),
  };
}

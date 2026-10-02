// Narrow Squads v4 wire adapter, verified against the deployed immutable program in LiteSVM.
// No transaction RPC or keys here. Only vault 0, one instruction, no ALTs or ephemeral signers.
import {
  pda,
  pub,
  integer,
  sha256,
  hex,
  concat,
  Reader,
  SYSTEM,
} from "./program.mjs";
export const SQUADS = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
export const FOUNDATION = "92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc";
export const TIMELOCK = 172800;
const byte = (n) => {
  if (!Number.isInteger(n) || n < 0 || n > 255)
    throw Error("Byte out of range");
  return Uint8Array.of(n);
};
const u16 = (n) => {
  if (n < 0 || n > 65535) throw Error("u16 out of range");
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
};
const vec = (b) => concat([integer(b.length, 4), b]);
const disc = async (name) => (await sha256(`global:${name}`)).slice(0, 8);
const meta = (address, role = 0, signer) => ({
  address,
  role,
  ...(signer ? { signer } : {}),
});
const ix = async (name, accounts, data = new Uint8Array()) => ({
  programAddress: SQUADS,
  accounts,
  data: concat([await disc(name), data]),
});
export const squadAddress = (createKey) =>
  pda(SQUADS, "multisig", "multisig", pub(createKey));
export const vaultAddress = (multisig) =>
  pda(SQUADS, "multisig", pub(multisig), "vault", byte(0));
export const programConfigAddress = () =>
  pda(SQUADS, "multisig", "program_config");
export const transactionAddress = (multisig, index) =>
  pda(SQUADS, "multisig", pub(multisig), "transaction", integer(index));
export const proposalAddress = (multisig, index) =>
  pda(
    SQUADS,
    "multisig",
    pub(multisig),
    "transaction",
    integer(index),
    "proposal",
  );
export async function decodeMultisig(address, account) {
  if ((account.owner ?? account.programAddress) !== SQUADS)
    throw Error("Wrong Squads account owner");
  const r = new Reader(account.data);
  if (hex(r.take(8)) !== hex((await sha256("account:Multisig")).slice(0, 8)))
    throw Error("Wrong multisig discriminator");
  const createKey = r.pub(),
    configAuthority = r.pub(),
    threshold = new DataView(r.take(2).buffer).getUint16(0, true),
    timeLock = r.u32();
  const transactionIndex = r.u64(),
    staleTransactionIndex = r.u64();
  const rentOption = r.u8();
  if (rentOption > 1) throw Error("Invalid option");
  if (rentOption) r.pub();
  r.u8();
  const members = r.vec(() => ({ address: r.pub(), permissions: r.u8() }));
  if ((await squadAddress(createKey)) !== address)
    throw Error("Wrong multisig PDA");
  return {
    address,
    createKey,
    configAuthority,
    threshold,
    timeLock,
    transactionIndex,
    staleTransactionIndex,
    members,
    vault: await vaultAddress(address),
  };
}
export function assertSafeMultisig(s) {
  if (
    s.configAuthority !== SYSTEM ||
    s.threshold !== 2 ||
    s.timeLock < TIMELOCK ||
    s.members.length !== 3 ||
    new Set(s.members.map((m) => m.address)).size !== 3 ||
    s.members.some((m) => m.permissions !== 7) ||
    !s.members.some((m) => m.address === FOUNDATION)
  )
    throw Error(
      "Requires autonomous 2-of-3, three distinct full-permission members including foundation, and a two-day minimum timelock",
    );
  return s;
}
export async function createMultisig({
  creator,
  createKey,
  treasury,
  members,
}) {
  if (
    members.length !== 3 ||
    new Set(members).size !== 3 ||
    !members.includes(FOUNDATION)
  )
    throw Error("Provide foundation and two distinct reviewer addresses");
  const multisig = await squadAddress(createKey.address);
  return ix(
    "multisig_create_v2",
    [
      meta(await programConfigAddress()),
      meta(treasury, 1),
      meta(multisig, 1),
      meta(createKey.address, 2, createKey),
      meta(creator.address, 3, creator),
      meta(SYSTEM),
    ],
    concat([
      byte(0),
      u16(2),
      integer(3, 4),
      ...members.map((a) => concat([pub(a), byte(7)])),
      integer(TIMELOCK, 4),
      byte(0),
      byte(0),
    ]),
  );
}
function compile(vault, instruction) {
  const map = new Map([[vault, 3]]);
  for (const a of instruction.accounts)
    map.set(a.address, (map.get(a.address) || 0) | a.role);
  map.set(instruction.programAddress, map.get(instruction.programAddress) || 0);
  if ([...map].some(([a, role]) => role >= 2 && a !== vault))
    throw Error("Only the Squads vault may sign the inner action");
  const keys = [...map].sort(
    ([a, ra], [b, rb]) =>
      (rb >= 2) - (ra >= 2) || (rb % 2) - (ra % 2) || a.localeCompare(b),
  );
  const signers = keys.filter(([, r]) => r >= 2).length,
    writableSigners = keys.filter(([, r]) => r === 3).length,
    writableNonSigners = keys.filter(([, r]) => r === 1).length;
  const indexes = Uint8Array.from(
    instruction.accounts.map((a) =>
      keys.findIndex(([key]) => key === a.address),
    ),
  );
  return {
    keys,
    bytes: concat([
      byte(signers),
      byte(writableSigners),
      byte(writableNonSigners),
      byte(keys.length),
      ...keys.map(([a]) => pub(a)),
      byte(1),
      byte(keys.findIndex(([a]) => a === instruction.programAddress)),
      byte(indexes.length),
      indexes,
      u16(instruction.data.length),
      instruction.data,
      byte(0),
    ]),
  };
}
export async function createProposal({ multisig, index, member, instruction }) {
  const vault = await vaultAddress(multisig),
    compiled = compile(vault, instruction),
    transaction = await transactionAddress(multisig, index),
    proposal = await proposalAddress(multisig, index);
  const create = await ix(
    "vault_transaction_create",
    [
      meta(multisig, 1),
      meta(transaction, 1),
      meta(member.address, 2, member),
      meta(member.address, 3, member),
      meta(SYSTEM),
    ],
    concat([byte(0), byte(0), vec(compiled.bytes), byte(0)]),
  );
  const propose = await ix(
    "proposal_create",
    [
      meta(multisig),
      meta(proposal, 1),
      meta(member.address, 2, member),
      meta(member.address, 3, member),
      meta(SYSTEM),
    ],
    concat([integer(index), byte(0)]),
  );
  return { transaction, proposal, create, propose };
}
export async function approveProposal({ multisig, index, member }) {
  return ix(
    "proposal_approve",
    [
      meta(multisig),
      meta(member.address, 3, member),
      meta(await proposalAddress(multisig, index), 1),
    ],
    byte(0),
  );
}
export async function executeProposal({
  multisig,
  index,
  member,
  instruction,
}) {
  const compiled = compile(await vaultAddress(multisig), instruction);
  return ix("vault_transaction_execute", [
    meta(multisig),
    meta(await proposalAddress(multisig, index), 1),
    meta(await transactionAddress(multisig, index)),
    meta(member.address, 2, member),
    ...compiled.keys.map(([a, role]) => meta(a, role % 2)),
  ]);
}
export async function assertTransactionMatches({
  multisig,
  index,
  instruction,
  account,
}) {
  if ((account.owner ?? account.programAddress) !== SQUADS)
    throw Error("Wrong transaction owner");
  const r = new Reader(account.data);
  if (
    hex(r.take(8)) !==
    hex((await sha256("account:VaultTransaction")).slice(0, 8))
  )
    throw Error("Wrong vault transaction type");
  if (r.pub() !== multisig) throw Error("Wrong multisig");
  r.pub();
  if (BigInt(r.u64()) !== BigInt(index)) throw Error("Wrong transaction index");
  r.u8();
  if (r.u8() !== 0) throw Error("Wrong vault");
  r.u8();
  if (r.u32() !== 0) throw Error("Ephemeral signers prohibited");
  const ns = r.u8(),
    nws = r.u8(),
    nwns = r.u8(),
    keys = r.vec(() => r.pub());
  const instructions = r.vec(() => {
    const program = r.u8(),
      indexes = r.vec(() => r.u8()),
      data = r.take(r.u32());
    return { program, indexes, data };
  });
  if (r.u32() !== 0 || instructions.length !== 1)
    throw Error("Only one action and no lookup tables allowed");
  const expected = compile(await vaultAddress(multisig), instruction),
    got = instructions[0];
  if (
    ns !== 1 ||
    nws !== 1 ||
    nwns !== expected.keys.filter(([, role]) => role === 1).length ||
    JSON.stringify(keys) !== JSON.stringify(expected.keys.map(([a]) => a)) ||
    keys[got.program] !== instruction.programAddress ||
    hex(got.data) !== hex(instruction.data) ||
    JSON.stringify(got.indexes.map((i) => keys[i])) !==
      JSON.stringify(instruction.accounts.map((a) => a.address))
  )
    throw Error("On-chain proposal differs from reviewed action");
}

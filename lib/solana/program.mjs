import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getAddressDecoder,
} from "@solana/kit";
export const TOKEN = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const SYSTEM = "11111111111111111111111111111111";
export const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
export const ZERO = SYSTEM;

const enc = new TextEncoder(),
  dec = new TextDecoder();
const addressBytes = (a) => getAddressEncoder().encode(a);
export const sha256 = async (text) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
export const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export function hashBytes(value) {
  if (value instanceof Uint8Array && value.length === 32) return value;
  if (!/^[a-f0-9]{64}$/i.test(value || ""))
    throw Error("Expected SHA-256 hex digest");
  return Uint8Array.from(value.match(/../g), (b) => parseInt(b, 16));
}
export function integer(value, bytes = 8, signed = false) {
  const out = new Uint8Array(bytes),
    view = new DataView(out.buffer);
  if (bytes === 8) {
    if (signed) view.setBigInt64(0, BigInt(value), true);
    else {
      if (BigInt(value) < 0n || BigInt(value) > 2n ** 64n - 1n)
        throw Error("Integer out of bounds");
      view.setBigUint64(0, BigInt(value), true);
    }
  } else view.setUint32(0, Number(value), true);
  return out;
}
export const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let offset = 0;
  for (const b of parts) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
};
const schemas = {
  initialize: [
    ["authority", "pub"],
    ["quoteMint", "pub"],
    ["testMode", "bool"],
    ["governanceMultisig", "pub"],
  ],
  launch: [
    ["name", "str"],
    ["symbol", "str"],
    ["source", "str"],
    ["virtualQuote", "u64"],
  ],
  requestAdoption: [["terms", "hash"]],
  approveAdoption: [
    ["nonce", "u64"],
    ["owner", "pub"],
    ["terms", "hash"],
    ["report", "hash"],
  ],
  finalizeAdoption: [],
  swap: [
    ["buy", "bool"],
    ["amount", "u64"],
    ["minOut", "u64"],
    ["deadline", "i64"],
  ],
  proposeMilestone: [
    ["community", "bool"],
    ["solReward", "bool"],
    ["amount", "u64"],
    ["deadline", "i64"],
    ["terms", "hash"],
    ["uri", "str"],
  ],
  reviewMilestone: [
    ["approve", "bool"],
    ["terms", "hash"],
    ["report", "hash"],
  ],
  submitWork: [["evidence", "hash"]],
  award: [
    ["revision", "u64"],
    ["evidence", "hash"],
    ["report", "hash"],
  ],
  reopen: [
    ["revision", "u64"],
    ["report", "hash"],
  ],
  pay: [],
  challenge: [["reason", "hash"]],
  resolve: [
    ["revision", "u64"],
    ["uphold", "bool"],
    ["report", "hash"],
  ],
  fundOss: [
    ["amount", "u64"],
    ["evidence", "hash"],
  ],
  buyBurn: [
    ["sol", "u64"],
    ["tokens", "u64"],
    ["report", "hash"],
  ],
  registerFund: [
    ["name", "str"],
    ["source", "str"],
  ],
  sponsor: [
    ["amount", "u64"],
    ["nonce", "u64"],
  ],
  settleSponsorship: [["refund", "bool"]],
  rejectAdoption: [["report", "hash"]],
  approveExpense: [
    ["amount", "u64"],
    ["invoice", "hash"],
    ["report", "hash"],
  ],
  claimExpense: [],
  claimFoundation: [],
  governed: [
    ["expiresAt", "i64"],
    ["action", "bytes"],
  ],
  initializeFeeDay: [["day", "i64"]],
  settleFeeDay: [["day", "i64"]],
  claimDevelopment: [["day", "i64"]],
  claimQuoteFoundation: [["day", "i64"]],
  approveQuoteExpense: [
    ["day", "i64"],
    ["amount", "u64"],
    ["invoice", "hash"],
    ["report", "hash"],
  ],
  claimQuoteExpense: [["day", "i64"]],
  cancelQuoteExpense: [["day", "i64"]],
  proposeQuoteMilestone: [
    ["day", "i64"],
    ["amount", "u64"],
    ["deadline", "i64"],
    ["terms", "hash"],
    ["uri", "str"],
  ],
};
export function encodeAction(name, args = {}) {
  const fields = schemas[name];
  if (!fields) throw Error("Unknown instruction");
  return concat([
    Uint8Array.of(Object.keys(schemas).indexOf(name)),
    ...fields.map(([key, type]) => {
      const value = args[key];
      if (type === "bool") {
        if (typeof value !== "boolean") throw Error("Expected boolean");
        return Uint8Array.of(value ? 1 : 0);
      }
      if (type === "bytes") {
        if (!(value instanceof Uint8Array) || value.length > 900)
          throw Error("Invalid bounded action");
        return concat([integer(value.length, 4), value]);
      }
      if (type === "pub") return addressBytes(value);
      if (type === "hash") return hashBytes(value);
      if (type === "str") {
        if (typeof value !== "string") throw Error("Expected text");
        const b = enc.encode(value);
        return concat([integer(b.length, 4), b]);
      }
      return integer(value, 8, type === "i64");
    }),
  ]);
}
export async function pda(program, ...seeds) {
  return (
    await getProgramDerivedAddress({
      programAddress: program,
      seeds: seeds.map((s) => (typeof s === "string" ? enc.encode(s) : s)),
    })
  )[0];
}
export const pub = addressBytes;
export async function launchAddresses(program, creator, count) {
  const factory = await pda(program, "factory"),
    mint = await pda(program, "mint", pub(creator), integer(count)),
    project = await pda(program, "project", pub(mint));
  return {
    factory,
    mint,
    project,
    pool: await pda(program, "pool", pub(project)),
    reserve: await pda(program, "reserve", pub(project)),
    quotePool: await pda(program, "quote-pool", pub(project)),
  };
}
export function instruction(program, name, args, accounts, signers = []) {
  return {
    programAddress: program,
    data: encodeAction(name, args),
    accounts: accounts
      .map((address, i) => ({
        address,
        role: i === 0 || signers.some((s) => s.address === address) ? 3 : 1,
        ...(signers.find((s) => s.address === address)
          ? { signer: signers.find((s) => s.address === address) }
          : {}),
      }))
      .map((a) =>
        [SYSTEM, TOKEN, LOADER, program].includes(a.address)
          ? { ...a, role: 0 }
          : a,
      ),
  };
}
export class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.i = 0;
  }
  take(n) {
    if (this.i + n > this.b.length) throw Error("Truncated account");
    const v = this.b.slice(this.i, this.i + n);
    this.i += n;
    return v;
  }
  u8() {
    return this.take(1)[0];
  }
  u64() {
    return new DataView(this.take(8).buffer).getBigUint64(0, true).toString();
  }
  i64() {
    return new DataView(this.take(8).buffer).getBigInt64(0, true).toString();
  }
  u32() {
    return new DataView(this.take(4).buffer).getUint32(0, true);
  }
  pub() {
    return getAddressDecoder().decode(this.take(32));
  }
  hash() {
    return hex(this.take(32));
  }
  bool() {
    const n = this.u8();
    if (n > 1) throw Error("Invalid bool");
    return n === 1;
  }
  str() {
    const n = this.u32();
    if (n > 8192) throw Error("Oversized string");
    return dec.decode(this.take(n));
  }
  vec(fn) {
    const n = this.u32();
    if (n > 256) throw Error("Oversized vector");
    return Array.from({ length: n }, () => fn());
  }
}
export function decodeAccount(bytes) {
  const r = new Reader(bytes),
    tag = r.u8();
  if (tag === 10)
    return {
      tag,
      authority: r.pub(),
      quoteMint: r.pub(),
      testMode: r.bool(),
      count: r.u64(),
      fees: r.u64(),
      retiredBudget: r.u64(),
      ossBudget: r.u64(),
      governanceBudget: r.u64(),
      foundationBudget: r.u64(),
      governanceMultisig: r.pub(),
      expenseCommitted: r.u64(),
      expenseNextAt: r.i64(),
    };
  if (tag === 2)
    return {
      tag,
      mint: r.pub(),
      owner: r.pub(),
      adopted: r.bool(),
      adoptionAt: r.i64(),
      adoptionNonce: r.u64(),
      adoptionHash: r.hash(),
      adoptionChallenged: r.bool(),
      virtualQuote: r.u64(),
      tokenReserve: r.u64(),
      quoteReserve: r.u64(),
      devReleased: r.u64(),
      workerReleased: r.u64(),
      devCommitted: r.u64(),
      workerCommitted: r.u64(),
      milestoneCount: r.u64(),
      tokenless: r.bool(),
      solAvailable: r.u64(),
      solCommitted: r.u64(),
      refundable: r.u64(),
      solFunded: r.u64(),
      awards: r.vec(() => r.pub()),
      releases: r.vec(() => ({ at: r.i64(), amount: r.u64() })),
      name: r.str(),
      symbol: r.str(),
      source: r.str(),
    };
  if (tag === 3)
    return {
      tag,
      project: r.pub(),
      id: r.u64(),
      community: r.bool(),
      amount: r.u64(),
      deadline: r.i64(),
      terms: r.hash(),
      uri: r.str(),
      status: r.u8(),
      readyAt: r.i64(),
      worker: r.pub(),
      evidence: r.hash(),
      revision: r.u64(),
      report: r.hash(),
      priorStatus: r.u64(),
      solReward: r.bool(),
      quoteDay: r.i64(),
      challenged: r.bool(),
      failedWorker: r.pub(),
    };
  if (tag === 4)
    return {
      tag,
      milestone: r.pub(),
      worker: r.pub(),
      revision: r.u64(),
      evidence: r.hash(),
    };
  if (tag === 5)
    return {
      tag,
      project: r.pub(),
      sponsor: r.pub(),
      nonce: r.u64(),
      amount: r.u64(),
      until: r.i64(),
      settled: r.bool(),
    };
  if (tag === 6) return { tag };
  if (tag === 7)
    return {
      tag,
      invoice: r.hash(),
      report: r.hash(),
      amount: r.u64(),
      readyAt: r.i64(),
      paid: r.bool(),
    };
  if (tag === 8)
    return {
      tag,
      project: r.pub(),
      day: r.i64(),
      fees: r.u64(),
      development: r.u64(),
      community: r.u64(),
      communityCommitted: r.u64(),
      governance: r.u64(),
      expenseCommitted: r.u64(),
      expenseApproved: r.u64(),
      foundation: r.u64(),
      settled: r.bool(),
    };
  if (tag === 9)
    return {
      tag,
      feeDay: r.pub(),
      invoice: r.hash(),
      report: r.hash(),
      amount: r.u64(),
      readyAt: r.i64(),
      status: r.u8(),
    };
  throw Error("Unknown account kind");
}
export function units(value, decimals) {
  if (!/^\d+(\.\d+)?$/.test(String(value)))
    throw Error("Use a positive decimal amount");
  const [whole, frac = ""] = String(value).split(".");
  if (frac.length > decimals) throw Error("Too many decimal places");
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(frac.padEnd(decimals, "0"));
  if (result <= 0n || result > 2n ** 64n - 1n)
    throw Error("Amount out of range");
  return result;
}
export function quote(p, buy, amount) {
  amount = BigInt(amount);
  const tokens = BigInt(p.tokenReserve),
    real = BigInt(p.quoteReserve),
    virtual = BigInt(p.virtualQuote);
  if (amount <= 0n) throw Error("Invalid amount");
  if (buy) {
    const fee = (amount + 19n) / 20n,
      net = amount - fee;
    return { out: (tokens * net) / (virtual + real + net), fee };
  }
  const gross = ((virtual + real) * amount) / (tokens + amount);
  if (gross > real) throw Error("Not enough real e/acc in this pool");
  const fee = (gross + 19n) / 20n;
  return { out: gross - fee, fee };
}

export function governedInstruction(program, name, args, accounts, expiresAt) {
  return instruction(
    program,
    "governed",
    { expiresAt, action: encodeAction(name, args) },
    accounts,
  );
}

export async function feeDayAddresses(program, project, day) {
  const feeDay = await pda(
    program,
    "fee-day",
    pub(project),
    integer(day, 8, true),
  );
  return { feeDay, feeVault: await pda(program, "fee-vault", pub(feeDay)) };
}

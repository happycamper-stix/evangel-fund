import { TOKEN, pub } from "./program.mjs";
// Mirrors the deployed-candidate Rust mint predicate using raw account bytes.
export function inspectDaoMint(account, mint) {
  const reasons = [];
  if (!account) return { compatible: false, reasons: ["Mint account missing"] };
  if (account.owner !== TOKEN || account.executable !== false)
    reasons.push("Expected a non-executable Token-2022 mint");
  const data = Buffer.from(account.data);
  try {
    validateMetadata(data, mint);
  } catch {
    reasons.push("Unsupported, mutable or malformed mint extensions");
  }
  if (data.length < 82)
    return { compatible: false, reasons, byteLength: data.length };
  if (data.readUInt32LE(0) !== 0)
    reasons.push("Mint authority must be revoked");
  if (data.readUInt32LE(46) !== 0)
    reasons.push("Freeze authority must be revoked");
  if (data[44] !== 6 || data[45] !== 1)
    reasons.push("Mint must be initialized with six decimals");
  const supply = data.readBigUInt64LE(36);
  if (supply === 0n) reasons.push("Voting supply must be positive");
  return {
    compatible: reasons.length === 0,
    reasons,
    byteLength: data.length,
    decimals: data[44],
    supply: supply.toString(),
  };
}

function validateMetadata(d, mint) {
  if (d.length === 82) return;
  const check = (value) => {
    if (!value) throw Error("Invalid extension");
  };
  check(
    d.length > 166 && d.subarray(82, 165).every((v) => v === 0) && d[165] === 1,
  );
  const key = Buffer.from(pub(mint));
  let offset = 166;
  const seen = new Set();
  while (offset < d.length) {
    check(offset + 4 <= d.length);
    const kind = d.readUInt16LE(offset),
      size = d.readUInt16LE(offset + 2);
    offset += 4;
    check(offset + size <= d.length && !seen.has(kind));
    seen.add(kind);
    const value = d.subarray(offset, offset + size);
    offset += size;
    check(
      (kind === 18 || kind === 19) &&
        value.length >= 64 &&
        value.subarray(0, 32).every((v) => v === 0) &&
        value.subarray(32, 64).equals(key),
    );
    if (kind === 18) check(size === 64);
    else {
      let at = 64;
      const number = () => {
        check(at + 4 <= value.length);
        const n = value.readUInt32LE(at);
        at += 4;
        return n;
      };
      const string = () => {
        const n = number();
        check(at + n <= value.length);
        new TextDecoder("utf-8", { fatal: true }).decode(
          value.subarray(at, at + n),
        );
        at += n;
      };
      string();
      string();
      string();
      const count = number();
      check(count <= (value.length - at) / 8);
      for (let i = 0; i < count; i++) {
        string();
        string();
      }
      check(at === value.length);
    }
  }
  check(seen.size === 2 && seen.has(18) && seen.has(19));
}

import { LOADER, SYSTEM } from "./program.mjs";
// solana-loader-v3-interface 6.1.0: ExtendProgram=6, Upgrade=3.
export function upgradeActions({
  program,
  programData,
  buffer,
  authority,
  refundRecipient,
  additionalBytes,
}) {
  if (
    !Number.isSafeInteger(additionalBytes) ||
    additionalBytes < 0 ||
    additionalBytes > 0xffffffff
  )
    throw Error("Invalid program extension size.");
  const meta = (address, role) => ({ address, role });
  const u32 = (n) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  const actions = [];
  if (additionalBytes)
    actions.push({
      name: "ExtendProgram",
      programAddress: LOADER,
      accounts: [
        meta(programData, 1),
        meta(program, 1),
        meta(SYSTEM, 0),
        meta(authority, 3),
      ],
      data: Uint8Array.from([...u32(6), ...u32(additionalBytes)]),
    });
  actions.push({
    name: "Upgrade",
    programAddress: LOADER,
    accounts: [
      meta(programData, 1),
      meta(program, 1),
      meta(buffer, 1),
      meta(refundRecipient, 1),
      meta("SysvarRent111111111111111111111111111111111", 0),
      meta("SysvarC1ock11111111111111111111111111111111", 0),
      meta(authority, 2),
    ],
    data: u32(3),
  });
  return actions;
}

import { address } from "@solana/kit";
import { TOKEN, SYSTEM } from "./program.mjs";
import {
  daoAddress,
  daoStake,
  daoEscrow,
  daoBallot,
  daoInstruction,
} from "./dao.mjs";
const ro = (value) => ({ address: address(value), role: 0 });
const rw = (value) => ({ address: address(value), role: 1 });
// Restricted holder actions. No caller-supplied account metas or arbitrary CPI.
export async function holderInstruction({
  program,
  target,
  mint,
  signer,
  action,
  tokenAccount,
  proposal,
  amount,
  evidence,
  approve,
}) {
  address(program);
  address(target);
  address(mint);
  address(signer.address);
  const config = await daoAddress(program, target);
  const stake = await daoStake(program, config, signer.address);
  const escrow = await daoEscrow(program, config, signer.address);
  let rest,
    args = {};
  if (action === "deposit" || action === "withdraw") {
    rest = [rw(stake), rw(escrow), rw(tokenAccount), ro(mint), ro(TOKEN)];
    if (action === "deposit") {
      if (
        !/^[1-9][0-9]*$/.test(String(amount)) ||
        BigInt(amount) > 18446744073709551615n
      )
        throw Error("Invalid deposit amount");
      args = { amount: BigInt(amount) };
      rest.push(ro(SYSTEM));
    }
  } else if (action === "challenge" || action === "vote") {
    rest = [
      rw(proposal),
      rw(stake),
      rw(await daoBallot(program, proposal, signer.address)),
      ro(SYSTEM),
    ];
    if (action === "challenge") {
      if (!/^[a-f0-9]{64}$/i.test(evidence || "") || /^0+$/.test(evidence))
        throw Error("Nonzero evidence SHA-256 required");
      args = { evidence };
    } else {
      if (typeof approve !== "boolean") throw Error("Explicit vote required");
      args = { approve };
    }
  } else throw Error("Unsupported holder action");
  return daoInstruction(program, action, args, [
    { address: signer.address, role: 3, signer },
    rw(config),
    ...rest,
  ]);
}

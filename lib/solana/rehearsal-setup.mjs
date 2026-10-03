import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import {
  getInitializeMetadataPointerInstruction,
  getInitializeMint2Instruction,
  getInitializeTokenMetadataInstruction,
  getUpdateTokenMetadataUpdateAuthorityInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getMintToCheckedInstruction,
  getSetAuthorityInstruction,
} from "@solana-program/token-2022";
import {
  TOKEN,
  LOADER,
  SYSTEM,
  pda,
  pub,
  integer,
  concat,
} from "./program.mjs";
export const REHEARSAL_SUPPLY = 21_000_000_000_000n;
export const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const rehearsalTokenAccount = (mint, owner) =>
  pda(ATA, pub(owner), pub(TOKEN), pub(mint));
export function rehearsalMintInstructions({ payer, mint, rent }) {
  return [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: BigInt(rent),
      space: 234n,
      programAddress: TOKEN,
    }),
    getInitializeMetadataPointerInstruction({
      mint: mint.address,
      authority: null,
      metadataAddress: mint.address,
    }),
    getInitializeMint2Instruction({
      mint: mint.address,
      decimals: 6,
      mintAuthority: payer.address,
      freezeAuthority: null,
    }),
    getInitializeTokenMetadataInstruction({
      metadata: mint.address,
      updateAuthority: payer.address,
      mint: mint.address,
      mintAuthority: payer,
      name: "Evangel governance test token",
      symbol: "TESTGOV",
      uri: "https://evangel.fund/governor/rehearsal",
    }),
    getUpdateTokenMetadataUpdateAuthorityInstruction({
      metadata: mint.address,
      updateAuthority: payer,
      newUpdateAuthority: null,
    }),
  ];
}
export async function rehearsalAllocationInstructions({
  payer,
  mint,
  owner,
  amount,
}) {
  const ata = await rehearsalTokenAccount(mint, owner);
  return [
    getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata,
      owner,
      mint,
      tokenProgram: TOKEN,
    }),
    getMintToCheckedInstruction({
      mint,
      token: ata,
      mintAuthority: payer,
      amount,
      decimals: 6,
    }),
    getTransferSolInstruction({
      source: payer,
      destination: owner,
      amount: 20_000_000n,
    }),
  ];
}
export const revokeRehearsalMint = (mint, payer) =>
  getSetAuthorityInstruction({
    owned: mint,
    owner: payer,
    authorityType: 0,
    newAuthority: null,
  });
export function loaderAuthorityInstruction(programData, payer, next) {
  return {
    programAddress: LOADER,
    accounts: [
      { address: programData, role: 1 },
      { address: payer.address, role: 2, signer: payer },
      ...(next ? [{ address: next, role: 0 }] : []),
    ],
    data: integer(4, 4),
  };
}
export async function deployRehearsalTargetInstructions({
  payer,
  target,
  buffer,
  rent,
  length,
}) {
  return [
    getCreateAccountInstruction({
      payer,
      newAccount: target,
      lamports: BigInt(rent),
      space: 36n,
      programAddress: LOADER,
    }),
    {
      programAddress: LOADER,
      accounts: [
        { address: payer.address, role: 3, signer: payer },
        { address: await pda(LOADER, pub(target.address)), role: 1 },
        { address: target.address, role: 1 },
        { address: buffer, role: 1 },
        { address: "SysvarRent111111111111111111111111111111111", role: 0 },
        { address: "SysvarC1ock11111111111111111111111111111111", role: 0 },
        { address: SYSTEM, role: 0 },
        { address: payer.address, role: 2, signer: payer },
      ],
      data: concat([integer(2, 4), integer(length)]),
    },
  ];
}

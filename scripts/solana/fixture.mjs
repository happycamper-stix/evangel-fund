import { NETWORK } from "./runtime.mjs";
// Dummy test asset only. The former OTC settlement command has been removed.
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getInitializeMint2Instruction,
  getInitializeAccount3Instruction,
  getMintToCheckedInstruction,
  getSetAuthorityInstruction,
} from "@solana-program/token-2022";
import {
  assertDevelopmentCluster,
  signer,
  rpc,
  account,
  save,
  submit,
  GENESIS,
} from "./runtime.mjs";
import { TOKEN } from "../../lib/solana/program.mjs";
if (process.argv[2] !== "deploy")
  throw Error(
    "Only fixture.mjs deploy is supported. Unverified OTC settlement is disabled.",
  );
await assertDevelopmentCluster();
const operator = await signer("operator"),
  mint = await signer("quote-mint"),
  inventory = await signer("inventory");
const existing = await account(mint.address);
if (existing) {
  const i = existing.data?.parsed?.info;
  if (
    existing.owner !== TOKEN ||
    i?.decimals !== 6 ||
    i.mintAuthority !== null ||
    i.freezeAuthority !== null
  )
    throw Error("Existing dummy mint has unexpected authorities");
} else {
  const rent = async (n) =>
    BigInt(await rpc("getMinimumBalanceForRentExemption", [n]));
  await submit(
    [
      getCreateAccountInstruction({
        payer: operator,
        newAccount: mint,
        lamports: await rent(82),
        space: 82n,
        programAddress: TOKEN,
      }),
      getInitializeMint2Instruction({
        mint: mint.address,
        decimals: 6,
        mintAuthority: operator.address,
        freezeAuthority: null,
      }),
      getCreateAccountInstruction({
        payer: operator,
        newAccount: inventory,
        lamports: await rent(165),
        space: 165n,
        programAddress: TOKEN,
      }),
      getInitializeAccount3Instruction({
        account: inventory.address,
        mint: mint.address,
        owner: operator.address,
      }),
      getMintToCheckedInstruction({
        mint: mint.address,
        token: inventory.address,
        mintAuthority: operator,
        amount: 1_000_000_000_000n,
        decimals: 6,
      }),
      getSetAuthorityInstruction({
        owned: mint.address,
        owner: operator,
        authorityType: 0,
        newAuthority: null,
      }),
    ],
    operator,
    { journal: "dummy-quote-v3.json" },
  );
}
await save("deployment.json", {
  version: 3,
  dummy: true,
  genesis: GENESIS,
  "quote-mint": mint.address,
  inventory: inventory.address,
});
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    dummy: true,
    mint: mint.address,
    mintAuthority: null,
    freezeAuthority: null,
    quoteAsset: "dummy-eacc",
  }),
);

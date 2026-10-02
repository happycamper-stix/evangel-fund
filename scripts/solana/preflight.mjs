import { NETWORK } from "./runtime.mjs";
import {
  assertDevelopmentCluster,
  signer,
  rpc,
  finalized,
} from "./runtime.mjs";
await assertDevelopmentCluster();
const payer = await signer("operator");
let balance = (
  await rpc("getBalance", [payer.address, { commitment: "finalized" }])
).value;
console.log(
  JSON.stringify({
    cluster: NETWORK.cluster,
    publicAddress: payer.address,
    lamports: balance,
  }),
);
if (balance < 50_000_000 && process.argv.includes("--airdrop")) {
  // One faucet attempt only; no address rotation or rate-limit circumvention.
  const signature = await rpc("requestAirdrop", [
    payer.address,
    1_000_000_000,
    { commitment: "finalized" },
  ]);
  await finalized(signature);
  balance = (
    await rpc("getBalance", [payer.address, { commitment: "finalized" }])
  ).value;
  console.log(JSON.stringify({ airdrop: signature, lamports: balance }));
}
if (balance < 50_000_000)
  throw new Error(
    `Fund the selected development-network wallet ${payer.address} with at least 0.05 test SOL.`,
  );

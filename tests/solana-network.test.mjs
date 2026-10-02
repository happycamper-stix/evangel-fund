import test from "node:test";
import assert from "node:assert/strict";
import { solanaNetwork, solanaRpcUrl } from "../lib/solana/network.mjs";
test("development network selection binds genesis, RPC, wallet chain and artifact directory", () => {
  for (const cluster of ["devnet", "testnet"]) {
    const n = solanaNetwork(cluster);
    assert.equal(n.chain, `solana:${cluster}`);
    assert.equal(n.root, `.evangel/solana-${cluster}`);
    assert.equal(n.rpcUrl, `https://api.${cluster}.solana.com`);
  }
  assert.notEqual(
    solanaNetwork("devnet").genesis,
    solanaNetwork("testnet").genesis,
  );
  for (const bad of ["mainnet-beta", "mainnet", "", "toString", "__proto__"])
    assert.throws(() => solanaNetwork(bad));
  assert.equal(
    solanaRpcUrl({ SOLANA_TESTNET_RPC_URL: "https://testnet.invalid" }),
    "https://api.devnet.solana.com",
  );
  assert.equal(
    solanaRpcUrl({
      NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER: "testnet",
      SOLANA_TESTNET_RPC_URL: "https://testnet.invalid",
    }),
    "https://testnet.invalid",
  );
});

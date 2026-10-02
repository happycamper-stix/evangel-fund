// Only disposable development clusters are supported. Unknown values fail closed.
export function solanaNetwork(
  cluster = process.env.NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER || "devnet",
) {
  if (!["devnet", "testnet"].includes(cluster))
    throw Error("Only Solana devnet or testnet is allowed.");
  const genesis = {
    devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
  }[cluster];
  if (!genesis) throw Error("Only Solana devnet or testnet is allowed.");
  return {
    cluster,
    chain: `solana:${cluster}`,
    genesis,
    rpcUrl: `https://api.${cluster}.solana.com`,
    root: `.evangel/solana-${cluster}`,
  };
}
export function solanaRpcUrl(env = process.env) {
  const network = solanaNetwork(
    env.NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER || "devnet",
  );
  return (
    env[
      network.cluster === "devnet"
        ? "SOLANA_DEVNET_RPC_URL"
        : "SOLANA_TESTNET_RPC_URL"
    ] || network.rpcUrl
  );
}

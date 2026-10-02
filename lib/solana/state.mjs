import { solanaNetwork, solanaRpcUrl } from "./network.mjs";
import { solanaConfig } from "./config.mjs";
import { decodeMultisig, assertSafeMultisig } from "./squads.mjs";
import { decodeAccount, pda } from "./program.mjs";
export async function rpc(method, params = []) {
  const res = await fetch(solanaRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw Error("Solana RPC unavailable");
  const json = await res.json();
  if (json.error) throw Error("Solana RPC rejected request");
  return json.result;
}
export async function assertCluster() {
  if ((await rpc("getGenesisHash")) !== solanaNetwork().genesis)
    throw Error("Wrong Solana cluster");
}
export async function state() {
  const config = solanaConfig();
  if (!config.configured)
    return {
      config,
      factory: null,
      projects: [],
      milestones: [],
      submissions: [],
      sponsorships: [],
    };
  await assertCluster();
  const rows = await rpc("getProgramAccounts", [
    config.program,
    { encoding: "base64", commitment: "finalized" },
  ]);
  const accounts = rows
    .filter((r) => r.account.data[0])
    .map((r) => ({
      address: r.pubkey,
      ...decodeAccount(Buffer.from(r.account.data[0], "base64")),
    }));
  const fa = await pda(config.program, "factory");
  const factory = accounts.find((a) => a.tag === 10 && a.address === fa);
  let governance = null;
  if (factory) {
    if (
      !config.governanceMultisig ||
      factory.governanceMultisig !== config.governanceMultisig
    )
      throw Error("Governance multisig not configured or mismatched");
    const account = (
      await rpc("getAccountInfo", [
        factory.governanceMultisig,
        { encoding: "base64", commitment: "finalized" },
      ])
    ).value;
    if (!account) throw Error("Governance account unavailable");
    governance = assertSafeMultisig(
      await decodeMultisig(factory.governanceMultisig, {
        owner: account.owner,
        data: new Uint8Array(Buffer.from(account.data[0], "base64")),
      }),
    );
    if (factory.authority !== governance.vault)
      throw Error("Factory authority is not the verified Squads vault");
  }
  return {
    config,
    governance,
    expenses: accounts.filter((a) => a.tag === 9),
    feeDays: accounts.filter((a) => a.tag === 8),
    factory: accounts.find((a) => a.tag === 10 && a.address === fa) || null,
    projects: accounts.filter((a) => a.tag === 2),
    milestones: accounts.filter((a) => a.tag === 3),
    submissions: accounts.filter((a) => a.tag === 4),
    sponsorships: accounts.filter((a) => a.tag === 5),
  };
}

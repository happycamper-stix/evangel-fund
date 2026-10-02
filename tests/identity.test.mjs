import test from "node:test";
import assert from "node:assert/strict";
import { verifyRepository, repositoryName } from "../lib/identity/github.mjs";
const wallet = "92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc";
function fixture() {
  const user = {
    web3Wallets: [
      {
        web3Wallet: wallet,
        verification: { status: "verified", strategy: "web3_solana_signature" },
      },
    ],
    externalAccounts: [
      {
        id: "account",
        provider: "oauth_github",
        providerUserId: "123",
        verification: { status: "verified" },
      },
    ],
  };
  const repo = {
    id: 99,
    full_name: "builder/project",
    owner: { id: 123, type: "User" },
    permissions: {},
  };
  const pr = {
    merged_at: "2026-01-01",
    user: { id: 123 },
    base: { repo: { id: 99 } },
    html_url: "https://github.com/builder/project/pull/1",
  };
  const client = {
    users: {
      getUser: async () => user,
      getUserOauthAccessToken: async () => ({
        data: [{ externalAccountId: "account", token: "server-only-token" }],
      }),
    },
  };
  const fetcher = async (url, options) => {
    assert.equal(new URL(url).hostname, "api.github.com");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return {
      ok: true,
      json: async () =>
        url.endsWith("/user")
          ? { id: 123, login: "builder" }
          : url.includes("/pulls/")
            ? pr
            : repo,
    };
  };
  return {
    user,
    repo,
    pr,
    check: (args) =>
      verifyRepository(
        {
          client,
          userId: "u1",
          wallet,
          repository: "builder/project",
          ...args,
        },
        fetcher,
      ),
  };
}
test("repository URL rejects foreign hosts, traversal and injected queries", () => {
  for (const value of [
    "https://github.com.evil/x/y",
    "x/..",
    "x/y?z=1",
    "https://evil.com/x/y",
    "x/y/z",
  ])
    assert.throws(() => repositoryName(value));
});
test("verified owner is bound to GitHub stable identity and Solana wallet", async () => {
  const f = fixture();
  const proof = await f.check();
  assert.equal(proof.role, "owner");
  assert.equal(proof.repositoryId, 99);
  assert.ok(!JSON.stringify(proof).includes("server-only-token"));
});
test("unverified wallets and identity mismatch are rejected", async () => {
  const f = fixture();
  await assert.rejects(f.check({ wallet: "1".repeat(32) }));
  f.user.externalAccounts[0].providerUserId = "456";
  await assert.rejects(f.check(), /mismatch/);
  f.user.web3Wallets[0].verification.status = "unverified";
  await assert.rejects(f.check(), /wallet/);
});
test("organization membership and write access do not grant ownership", async () => {
  const f = fixture();
  f.repo.owner.type = "Organization";
  f.repo.permissions.push = true;
  assert.equal((await f.check()).role, "identity");
  f.repo.permissions.maintain = true;
  assert.equal((await f.check()).role, "maintainer");
  delete f.repo.permissions.maintain;
  assert.equal((await f.check()).role, "identity");
  f.repo.permissions.admin = true;
  assert.equal((await f.check()).role, "admin");
});
test("contributor needs a merged PR with matching author and repository", async () => {
  const f = fixture();
  f.repo.owner.id = 456;
  assert.equal((await f.check({ pullRequest: 1 })).role, "contributor");
  f.pr.user.id = 789;
  await assert.rejects(f.check({ pullRequest: 1 }));
  f.pr.user.id = 123;
  f.pr.base.repo.id = 100;
  await assert.rejects(f.check({ pullRequest: 1 }));
  f.pr.base.repo.id = 99;
  f.pr.merged_at = null;
  await assert.rejects(f.check({ pullRequest: 1 }));
});
test("private repositories and forks fail closed", async () => {
  const f = fixture();
  f.repo.private = true;
  await assert.rejects(f.check());
  f.repo.private = false;
  f.repo.fork = true;
  await assert.rejects(f.check());
});

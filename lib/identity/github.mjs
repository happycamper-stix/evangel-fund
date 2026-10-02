import { RequestError } from "../server/http.mjs";
export function repositoryName(value) {
  if (typeof value !== "string")
    throw new RequestError("Provide a GitHub repository URL.");
  const match =
    /^(?:https:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(
      value,
    );
  if (!match || [".", ".."].includes(match[2]))
    throw new RequestError(
      "Use github.com/owner/repository without query parameters.",
    );
  return `${match[1]}/${match[2]}`;
}
export async function verifyRepository(
  { client, userId, repository, wallet, pullRequest },
  fetcher = fetch,
) {
  const name = repositoryName(repository);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet || ""))
    throw new RequestError("Provide your verified Solana wallet address.");
  const user = await client.users.getUser(userId);
  if (
    !user.web3Wallets?.some(
      (w) =>
        w.web3Wallet === wallet &&
        w.verification?.status === "verified" &&
        w.verification?.strategy === "web3_solana_signature",
    )
  )
    throw new RequestError(
      "Link and verify this Solana wallet in your account first.",
      403,
    );
  const account = user.externalAccounts?.find(
    (a) => a.provider === "oauth_github" || a.provider === "github",
  );
  if (!account || account.verification?.status !== "verified")
    throw new RequestError("Connect a verified GitHub account first.", 403);
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");
  const token = tokens.data?.find(
    (t) => t.externalAccountId === account.id,
  )?.token;
  if (!token)
    throw new RequestError(
      "Reconnect GitHub to authorize repository verification.",
      403,
    );
  const get = async (path) => {
    const response = await fetcher(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new RequestError(
        "GitHub could not verify access. Reconnect GitHub or retry later.",
        response.status === 429 ? 429 : 403,
      );
    return response.json();
  };
  const identity = await get("/user");
  if (String(identity.id) !== String(account.providerUserId))
    throw new RequestError("GitHub identity mismatch.", 403);
  const repo = await get(`/repos/${name}`);
  if (repo.private || repo.fork || !repo.id || !repo.owner?.id)
    throw new RequestError(
      "Verification currently supports public, non-fork repositories.",
    );
  let role = "identity";
  if (repo.owner.type === "User" && repo.owner.id === identity.id)
    role = "owner";
  else if (repo.permissions?.admin === true) role = "admin";
  else if (repo.permissions?.maintain === true) role = "maintainer";
  let evidence = null;
  if (pullRequest !== undefined && pullRequest !== "") {
    const number = Number(pullRequest);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new RequestError("Use a valid pull request number.");
    const pr = await get(`/repos/${name}/pulls/${number}`);
    if (
      !pr.merged_at ||
      pr.user?.id !== identity.id ||
      pr.base?.repo?.id !== repo.id
    )
      throw new RequestError(
        "The merged pull request must belong to this repository and your GitHub account.",
        403,
      );
    if (role === "identity") role = "contributor";
    evidence = pr.html_url;
  }
  return {
    userId,
    githubId: identity.id,
    login: identity.login,
    repositoryId: repo.id,
    repository: repo.full_name,
    wallet,
    role,
    evidence,
    checkedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
}

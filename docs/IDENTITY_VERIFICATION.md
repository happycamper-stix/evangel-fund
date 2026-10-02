# GitHub and Solana identity

The `/verify` page connects a Clerk session to a GitHub external account and a verified Solana wallet. GitHub OAuth tokens stay server-side. The verification API accepts no user ID from the browser: it uses the authenticated session.

Roles are distinct: personal repository owner, repository admin, maintainer, contributor (an authored merged PR in the same repository), or identity only. Write permission or organization membership is insufficient for adoption. Public non-fork repositories are supported initially. New workers can verify identity without prior contribution history; delivery still requires independent evidence.

Governance requests for `approveAdoption` and `award` must include `identity: { userId, pullRequest? }`. Use the identity reference returned to the signed-in user. Both governor modes fetch the user and current GitHub permissions again, verify the exact payout wallet, and bind stable identity facts into the report context. The repository is derived from onchain project source, not caller input. An adoption owner must control that repository. A worker must control the submission wallet. This response is not a bearer credential or an onchain attestation; manual quorum signers remain responsible for checking identity before execution.

## Configuration still required

The Marketplace resource is provisioned. At initial implementation, both local and Vercel production variables referenced a development Clerk instance. Before production activation:

1. Open the existing Clerk resource in Vercel; do not create a replacement application.
2. Enable GitHub OAuth and Solana Web3 connections. Configure the production GitHub OAuth credentials and callback specified by Clerk.
3. Configure the live instance and `evangel.fund` domain/DNS. Update Vercel managed variables through that integration and redeploy.
4. Sign in with a real GitHub account, link a Solana wallet by signing Clerk's nonce, verify a repository, and confirm sign-out/revoked-access behavior.

Never enter a wallet private key. Clerk wallet verification requires a message signature, not a transaction or seed phrase. Secret keys belong only in server environment variables. Do not publish the returned identity reference unnecessarily.

## Security scope

This does not replace the Solana program's quorum, challenge period, immutable recipients or financial caps. GitHub or Clerk outages fail closed. OAuth proves account control, not that work is valuable or that an admin may personally receive organizational funds; reviewers must verify organizational authorization and adoption terms. Non-GitHub sources cannot currently pass automatic adoption checks. Provider responses are not cached for approval.

## Verification results (2026-10-01)

- 45 Node unit/integration tests passed, including six identity tests covering wallet/account mismatch, role boundaries, revocation, contributor evidence and URL validation.
- 44 existing desktop/mobile browser checks passed.
- Production build passed. The production setup page passed desktop/mobile accessibility and overflow checks; the identity API returned 503 with development keys, and retired auth endpoints remained 410.
- Dependency audit reported zero vulnerabilities.
- Real GitHub OAuth + wallet linking remains pending dashboard setup and a real-account acceptance test; mocked provider tests do not establish that end-to-end flow works.

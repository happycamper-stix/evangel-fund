> Superseded decision: the founder chose a published internal review on October 2. No external engagement is planned. The scope below remains a reference for peer review; the quote draft was not sent. Current report: public/internal-security-review.md.

# Independent audit handoff

Status: scope prepared, no auditor engaged, no external approval. Freeze a commit after the venue adapter is complete; the current code is a development pilot and cannot serve as the final trading release candidate.

## Source and deployment

Private repository: https://github.com/happycamper-stix/evangel. Grant named auditors read access only after agreeing scope. Do not send environment files, Keychain exports, wallet keys, local `.evangel` artifacts or Vercel credentials. Public Devnet addresses, binary hash/length and reviewer baseline are in `DEVNET_ADDRESSES.json`.

- Custody/state machine: `solana/program/src/lib.rs`, `fees.rs`, `governance.rs`.
- Client encoding and governance transaction comparison: `lib/solana/program.mjs`, `squads.mjs`, `lib/governance/reviewer.mjs`.
- Identity: `lib/identity/github.mjs`, identity API and Clerk middleware. Identity is freshly checked by the evaluator, not cryptographically proven to the onchain factory; quorum must validate the evidence and wallet binding.
- Agent trust boundary: `lib/governance`, `scripts/solana/governor.mjs`. Agent output is an unsigned recommendation; two real reviewers and a delay authorize changes.
- Trading: `fee-policy.mjs` is target receipt allocation; legacy fixture trading is not the proposed DAMM adapter. Audit the final CPI integration and deployed venue binary separately.
- Operational custody: deploy/governance scripts, monitor, daily settlement transaction journal, browser wallet signing and immutable destination checks.

## Required attacks and invariants

Account/PDA substitution, wrong owner/program, duplicate accounts, signer privilege escalation, forged/replayed proposal or adoption nonce, expiry and timelock bypass, arithmetic overflow/rounding, double payout, cross-project/day leakage, refund after commitment, reserve depletion, direct unapproved token transfer, treasury insolvency, fee-recipient diversion, arbitrary CPI, hostile mint extensions and transferred position NFT/delegate powers. Test prompt injection and forged/revoked GitHub identity without assuming agent correctness.

For the venue adapter: initialize exactly 21M, deposit exactly 70%, retain exactly 30%, revoke mint/freeze, permanently lock all initial liquidity, custody the position NFT under a restricted PDA, enforce quote-only fixed 5% fees and no referral/dynamic fee, credit actual post-CPI received balances once. Direct pool users must receive the same venue fee policy. Test failed CPI rollback and transaction splitting. Verify source/binary provenance and upstream upgrade authority.

## Reproduction and acceptance

`npm ci`, `npm test`, `npm run test:browser`, `npm run build`, `npm run security:dependencies`, `npm run security:rust`. `npm test` requires the pinned local Solana SBF toolchain; document its exact version with the frozen release. Test production custody and test-fixture binaries separately. An audit must name the source commit and deployed binary, include remediation retesting, and explicitly identify excluded components. No unresolved critical/high findings for release. Track the upstream bincode maintenance warning and any upstream mutable programs.

## Quote request draft (not sent)

We seek an independent Solana security review of Evangel, an OSS funding and token-launch protocol. Scope includes Rust custody, governed rewards, 2-of-3 delayed Squads execution, GitHub/wallet adoption, fee accounting and a planned Meteora DAMM v2 integration. Mainnet is disabled. Please provide availability, review methodology, required preparation, estimated scope/cost, remediation retest coverage and report publication terms. We can provide a private read-only repository after agreeing access. We need a staged custody review and a final integration review before a capped mainnet pilot.

Potential firms for quotes: [OtterSec](https://osec.io/) and [Neodyme](https://neodyme.io/en/). Their official sites describe blockchain/security audit services; availability and pricing have not been obtained. No outreach, contract or payment has been made.

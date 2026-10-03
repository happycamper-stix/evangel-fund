# Release progress — October 2, 2026

**Update:** Development moved to Devnet using the existing 10 devnet SOL. The dummy quote mint is deployed and dependencies verified; factory deployment and multisig setup have now completed with the two supplied reviewer addresses. See DEVNET_DEPLOYMENT.md. The testnet funding notes below are historical and no longer block the active Devnet work.

Work proceeds through these gates in order. Passing unit tests is not a production release.

1. **Production identity — positive owner path verified.** Production GitHub OAuth, Solana wallet binding and repository-owner verification completed for happycamper-stix/evangel-fund and 92DFCX…BARjHc. SSL is issued and the production deployment is live. Revocation and account-mismatch adversarial acceptance tests remain separate gates.
2. **Public Devnet — deployed.** Factory and dummy quote mint are deployed; mint/freeze authorities are revoked. Factory and upgrade authority belong to the configured 2-of-3 Squads vault with a two-day delay. Public addresses and build hash are in `DEVNET_ADDRESSES.json`. The reviewer workspace now supports proposal creation, exact onchain transaction comparison, approval and execution. Real reviewer signatures and the full pilot remain outstanding.
3. **OSS pilot — pending previous gates and participants.** Recruit 3–5 consenting repository teams. No invitations have been sent. Each team must complete identity, registration/adoption, sponsorship/refund, milestone planning, contribution submission, approval/challenge, payout and reopening. Record finalized receipts and usability feedback. No real funds in this phase.
4. **Trading — fee specification conflict resolved; adapter remains blocked.** Approved gross fee: 5%. Protocol 1%; development 2.55%; contributors 0.5%; governance 0.8%; foundation 0.15%. The net receipt allocator has conservation and rounding tests. The existing isolated curve is a previous-version fixture, not this venue adapter. DBC reserve access before migration remains incompatible. Direct DAMM v2 is the proposed alternative; the live e/acc metadata extensions pass its pinned source policy. The local Rust CPI adapter, exact deposit enforcement and positive fee tests now pass against observed mainnet and Devnet binaries; mainnet source/binary equivalence now passes the pinned Linux build, while public-chain acceptance remains open; fee booking uses the approved collection day. See DAMM_ADAPTER_SPEC.md. Do not enable launch merely because the new fee numbers add up.
5. **Internal security review and capped mainnet — in progress.** The founder elected a first-party published review instead of an external audit. See `/internal-security-review.md` and `/docs/internal-security-review` for scope, fixed/open findings and exact source commit. No independent certification is claimed. The adoption contention and shared API rate-limit findings remain open; adapter implementation and real pilot remain required before mainnet.

## Fee implementation boundary

`lib/solana/fee-policy.mjs` is the approved target for actual net venue receipts. Cumulative amounts distribute 255/400 development, 50/400 community, 80/400 governance, 15/400 foundation. Integer dust stays in custody until daily close. The local venue review build integrates authenticated CPI balance deltas with the Rust allocator. It is not yet deployed. The old fixture economics are deliberately not advertised as the new production implementation.

## Acceptance evidence required

- Real GitHub + wallet login, revoked repo access, account mismatch and sign-out checks.
- Devnet deployment address, build hash, finalized initialization, verified upgrade authority and independent 2-of-3 governance.
- Full pilot receipts, including unsuccessful/challenged work and fixed-recipient payout.
- Venue transaction tests showing exact gross/net fees, zero initial quote liquidity plus the venue-required one-base-unit quote transfer, 21M minted once, protected 30%, upfront 1%, revoked mint/freeze authorities, and actual e/acc extension support.
- Daily settlement scheduler and monitoring exercised against deployed accounts, recovery drills and signer response procedures.
- Published internal review, resolved release-blocking findings and disclosed limitations.

## Alternative venue lead

Meteora's official Invent tooling documents `damm-v2-create-one-sided-pool --baseMint`, with base-only deposits and an existing mint. This is a research lead for keeping 30% outside the pool from initialization, rather than waiting for DBC graduation. It is not a verified adapter. Confirm quote-token ordering, exact protocol fees, permanent position locking with fee collection, actual e/acc extension compatibility, and CPI atomicity before adopting it. The source config's defaults (dynamic fees/rate limiting) must not be used unchanged for a fixed 5% fee.

Primary sources:
- https://github.com/MeteoraAg/meteora-invent/blob/main/README.md
- https://github.com/MeteoraAg/meteora-invent/blob/main/studio/src/actions/damm_v2/create_one_sided_pool.ts
- https://github.com/MeteoraAg/meteora-invent/blob/main/studio/config/damm_v2_config.jsonc

## Latest operational work

The monitor now verifies actual deployed program bytes against the published hash/length, in addition to authority, governance and custody balances. It passed against Devnet. A manually dispatched private-repository GitHub workflow runs the same read-only checks with no wallet key. The private-repository monitor now has a 30-minute schedule; notification delivery and incident response still need an operator drill. `PILOT_RUNBOOK.md` and `AUDIT_HANDOFF.md` contain the participant acceptance sequence and independent review scope. External participation and auditor engagement remain pending.

## October 2 hardening continuation

- Vercel published and validated the aggregate Solana route budget rule `rule_evangel_solana_aggregate_budget_eCLKaN`: 600 requests per 60 seconds, empty counting keys, `/api/solana/` prefix. An additional per-IP rule was rejected by the current plan and was not installed. Production enforcement still needs a controlled threshold test; do not describe configuration validation as load testing.
- `selectAdopter` is an append-only local ABI candidate. Quorum may select independently verified terms and an owner despite an unverified pending claim. Claimants cannot churn the nonce; rejection advances it. Existing approved/challenged/adopted states cannot be silently replaced through selection. The deployed Devnet hash and address record remain unchanged until reviewers authorize an upgrade.
- `PILOT_ADOPTION_TERMS.json` prepares the tokenless owner's acceptance transaction. No owner/reviewer signature or payout has been fabricated.

Validation for this candidate: 59 unit/integration tests, 48 browser tests, custody and fixture builds, and production web build pass. npm audit: zero vulnerabilities. Cargo audit: known bincode maintenance warning remains. Devnet monitor: no alerts against the unchanged deployed baseline. Candidate acceptance records are immutable per project/wallet/terms and are required by selection; identity verification alone is not consent.

## Venue executable integration prerequisite

The pinned observed DAMM executable now passes local initialization/locking tests (see DAMM_ADAPTER_SPEC.md). Exact 14.7M base deposit math and fixed-fee instruction construction are implemented. The venue requires one quote base unit even at the one-sided boundary; platform sponsorship is necessary to keep this cost off developers. There are 64 passing unit/integration tests plus 2 observed-venue tests. Custody CPI, positive trade/fee settlement, e/acc extension execution and source/binary equivalence remain open. Trading remains disabled.

## Rust venue adapter and operations continuation

A separate governance-enforcing adapter review build now exists alongside an isolated local candidate. See DAMM_ADAPTER_SPEC.md for exact coverage and limitations. The deployed Devnet program and disabled public launch flag remain unchanged. The collector CLI requires an explicit matching reviewed deployment baseline before signing.

The controlled production API budget probe recorded 600 HTTP 400 responses followed by 10 HTTP 429 responses in 13.2 seconds (LIVE_RATE_LIMIT_CHECK.json), without backend blockchain RPC. This proves the configured threshold for the tested path/window, not sustained capacity or notification delivery. Actual browser verification rejected an unrelated repository role and restored the correct owner's successful result; real permission revocation remains a separate acceptance test.

Mainnet venue provenance subsequently passed in the digest-pinned Linux workflow (DAMM_VERIFIED_BUILD.json). The initial macOS mismatch remains recorded as a historical failed attempt. Both comparison and scheduled-monitor workflows completed successfully. This does not authorize a custody upgrade or mainnet launch.

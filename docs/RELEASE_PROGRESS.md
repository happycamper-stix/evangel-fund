# Release progress — October 2, 2026

**Update:** Development moved to Devnet using the existing 10 devnet SOL. The dummy quote mint is deployed and dependencies verified; factory deployment and multisig setup have now completed with the two supplied reviewer addresses. See DEVNET_DEPLOYMENT.md. The testnet funding notes below are historical and no longer block the active Devnet work.

Work proceeds through these gates in order. Passing unit tests is not a production release.

1. **Production identity — blocked on account setup.** Clerk doctor reports an accountless application with no authenticated CLI account. Login has been initiated. Claim/configure the existing app, enable GitHub and Solana, configure live domain/credentials, and run real-account acceptance tests. Do not create a replacement app.
2. **Public Devnet — deployed.** Factory and dummy quote mint are deployed; mint/freeze authorities are revoked. Factory and upgrade authority belong to the configured 2-of-3 Squads vault with a two-day delay. Public addresses and build hash are in `DEVNET_ADDRESSES.json`. The reviewer workspace now supports proposal creation, exact onchain transaction comparison, approval and execution. Real reviewer signatures and the full pilot remain outstanding.
3. **OSS pilot — pending previous gates and participants.** Recruit 3–5 consenting repository teams. No invitations have been sent. Each team must complete identity, registration/adoption, sponsorship/refund, milestone planning, contribution submission, approval/challenge, payout and reopening. Record finalized receipts and usability feedback. No real funds in this phase.
4. **Trading — fee specification conflict resolved; adapter remains blocked.** Approved gross fee: 5%. Protocol 1%; development 2.55%; contributors 0.5%; governance 0.8%; foundation 0.15%. The net receipt allocator has conservation and rounding tests. The existing isolated curve is a previous-version fixture, not this venue adapter. DBC reserve access before migration remains incompatible. Direct DAMM v2 is the proposed alternative; the live e/acc metadata extensions pass its pinned source policy. Binary verification, the Rust CPI adapter, and one-sided rounding remain open; fee booking uses the approved collection day. See DAMM_ADAPTER_SPEC.md. Do not enable launch merely because the new fee numbers add up.
5. **Internal security review and capped mainnet — in progress.** The founder elected a first-party published review instead of an external audit. See `/internal-security-review.md` and `/docs/internal-security-review` for scope, fixed/open findings and exact source commit. No independent certification is claimed. The adoption contention and shared API rate-limit findings remain open; adapter implementation and real pilot remain required before mainnet.

## Fee implementation boundary

`lib/solana/fee-policy.mjs` is the approved target for actual net venue receipts. Cumulative amounts distribute 255/400 development, 50/400 community, 80/400 governance, 15/400 foundation. Integer dust stays in custody until daily close. It must be integrated with authenticated venue receipts and the Rust custody allocation together; replacing only a UI percentage or only the old fixture weights would misrepresent real trade accounting. The old fixture economics are deliberately not advertised as the new production implementation.

## Acceptance evidence required

- Real GitHub + wallet login, revoked repo access, account mismatch and sign-out checks.
- Devnet deployment address, build hash, finalized initialization, verified upgrade authority and independent 2-of-3 governance.
- Full pilot receipts, including unsuccessful/challenged work and fixed-recipient payout.
- Venue transaction tests showing exact gross/net fees, zero initial quote deposit, 21M minted once, protected 30%, upfront 1%, revoked mint/freeze authorities, and actual e/acc extension support.
- Daily settlement scheduler and monitoring exercised against deployed accounts, recovery drills and signer response procedures.
- Published internal review, resolved release-blocking findings and disclosed limitations.

## Alternative venue lead

Meteora's official Invent tooling documents `damm-v2-create-one-sided-pool --baseMint`, with base-only deposits and an existing mint. This is a research lead for keeping 30% outside the pool from initialization, rather than waiting for DBC graduation. It is not a verified adapter. Confirm quote-token ordering, exact protocol fees, permanent position locking with fee collection, actual e/acc extension compatibility, and CPI atomicity before adopting it. The source config's defaults (dynamic fees/rate limiting) must not be used unchanged for a fixed 5% fee.

Primary sources:
- https://github.com/MeteoraAg/meteora-invent/blob/main/README.md
- https://github.com/MeteoraAg/meteora-invent/blob/main/studio/src/actions/damm_v2/create_one_sided_pool.ts
- https://github.com/MeteoraAg/meteora-invent/blob/main/studio/config/damm_v2_config.jsonc

## Latest operational work

The monitor now verifies actual deployed program bytes against the published hash/length, in addition to authority, governance and custody balances. It passed against Devnet. A manually dispatched private-repository GitHub workflow runs the same read-only checks with no wallet key. No recurring schedule is enabled. `PILOT_RUNBOOK.md` and `AUDIT_HANDOFF.md` contain the participant acceptance sequence and independent review scope. External participation and auditor engagement remain pending.

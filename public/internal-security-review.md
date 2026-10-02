# Evangel internal security review — 2 October 2026

**Status: development release; not ready for mainnet trading.** This is a first-party, AI-assisted review by the team building Evangel. It is not an independent audit, certification, formal verification, or guarantee against loss. The founder chose this internal review instead of commissioning an external auditor. No external audit firm participated.

Reviewed source snapshot: `08892ae31eec6d97d23801a1c0d5f79f461b9f4e`. Documentation published afterward does not change that scope. Source is currently private; a source hash alone does not permit public reproduction. Peers with repository access can reproduce the checks below.

## Deployment and scope

Devnet factory: `Ac4F5CNu8tYdUx4RZTKRchFyj5nZ9wG12eh3zDVJn7LV`.
Deployed custody SHA-256: `7b9aa4d9b1aafe979fdfb7137d6106c8f70378e65040538b50df045f83d57382`, 220600 bytes. Program and upgrade authority belong to Squads vault `GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy`, with 2-of-3 approval and a 172800-second delay. Monitor comparison against actual deployed bytes passed. The program remains upgradeable by quorum.

Focused source inspection covered custody/account checks, governance envelopes, adoption, milestone review/release/challenge, sponsorship refunds, daily quote budgets, identity verification, reviewer transaction comparison, bounded evidence retrieval and monitoring. Automated tests also cover the isolated legacy trading fixture. Fixture results do not demonstrate a deployed trading adapter. This is not an exhaustive line-by-line review of every dependency, generated file or historical commit.

## Findings

| ID | Severity | Status | Finding and impact |
| --- | --- | --- | --- |
| EV-01 | Medium | Open | An unverified wallet can become the pending adopter and block another wallet's request until governance rejects it. Repeated contention can delay legitimate adoption. It does not complete adoption or authorize withdrawals. Reproduced in compiled-program local tests. The delayed real-governance recovery still needs a participant pilot. |
| EV-02 | Medium | Open | Public state/RPC endpoints make backend RPC requests without an aggregate shared request budget. Per-call method, size and timeout restrictions exist, but repeated requests can cause service exhaustion/provider cost. No live denial-of-service test was performed. A production rate-limit and alerting policy remains required. |
| EV-03 | Low | Fixed in reviewed client/CLI | Reviewer actions previously accepted an accounts list omitting the required terminal multisig account. Such proposals would fail onchain after reviewers spent transaction fees. Both governor and reviewer preflight now reject them; negative tests pass. |
| EV-04 | Medium | Fixed in reviewed monitor | Monitoring previously checked authority without comparing deployed code bytes and returned success for missing deployment configuration. It now checks the published binary hash, length and allocation padding, and missing deployment fails the check. Tampered/missing-baseline tests pass. |
| EV-05 | Informational | Open | RustSec flags upstream `bincode 1.3.3` as unmaintained (RUSTSEC-2025-0141). The scan reported no vulnerability advisory, but maintenance risk remains. |

EV-01 and EV-02 must be resolved and retested before an unrestricted launch. No claim is made that these are the only possible findings. Findings marked fixed above concern source/client/monitor changes; no custody program upgrade was made during this review.

## Verification performed

- Both default custody and isolated fixture SBF builds completed through `npm test`; the cached immutable Squads test binary was hash-checked.
- 57 unit/integration tests passed after review fixes, including real Squads quorum/delay/CPI tests in LiteSVM, supply/authority constraints, stale nonces, refund/replay, worker priority, failed-work reopening, balance conservation, wrong-account rejection, quote policy and collection-day accounting.
- 46 existing desktop/mobile browser checks passed during the review. These include wallet signing against isolated LiteSVM, docs rendering, accessibility and reviewer rejection. They are not real-user GitHub login or real reviewer signatures.
- `npm audit`: zero known vulnerabilities reported at review time.
- `cargo audit`: no vulnerability advisory reported; one unmaintained-dependency warning above.
- Devnet read-only monitor passed locally and in the private repository's manually dispatched GitHub workflow. No recurring monitor schedule or incident-response service is claimed.
- Finalized mainnet read-only e/acc inspection at slot 452744199: six decimals, null mint/freeze authority, only MetadataPointer and TokenMetadata extensions with null update authorities. These extensions match the pinned DAMM v2 source policy. No mainnet transaction was submitted.

## Explicit exclusions and release blockers

Production Clerk/GitHub acceptance, real maintainer adoption, real reviewer signatures, wall-clock challenge and payout pilot, the DAMM v2 CPI adapter, venue binary/source equivalence, one-sided liquidity rounding, actual 5% venue fee collection, immutable position custody, live collection-day settlement, mainnet transactions, sustained load tests and external assessment are not completed by this report.

The approved fee allocation and collection-day model are tested JavaScript specifications. Rust fixture fee weights remain historical and must not be described as the new integrated fee mechanism. Public launches stay disabled.

## Trust and custody risks

Two reviewers can collude, sign false evidence or authorize a program upgrade. A report hash proves a binding, not useful work or an honest invoice. GitHub ownership/roles and wallet linkage are offchain inputs freshly checked by the evaluator; the onchain program relies on quorum judgment. Public Devnet dependencies may themselves be upgradeable. No pause, recovery power, bounty funding or irreversible upgrade revocation is implied unless separately implemented and verified.

## Reproduction and updates

With private source access: `npm ci`, `npm test`, `npm run test:browser`, `npm run build`, `npm run security:dependencies`, `npm run security:rust`. SBF tests require the project's configured Solana toolchain. Run `scripts/solana/monitor.mjs` with the public Devnet program/multisig environment values and `docs/DEVNET_ADDRESSES.json` baseline. No private key is needed for monitoring. Use `npm run solana:inspect-quote` for a fresh read-only quote inspection.

Publish a new dated review after code changes, include exact commits and remediation tests, and retain prior findings until their fixes are verified. A later report must not inherit an approval merely from this test count.

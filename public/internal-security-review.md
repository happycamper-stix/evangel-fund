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

## Pilot addendum — 2 October 2026

EV-06 (medium, fixed in source `f11e0aa`): server RPC account decoding used Node Buffer slices with integer reads that ignored their backing-store offset. Registering the first real Devnet project exposed the issue as an Oversized vector error, making state retrieval unavailable. Reader now normalizes input into Uint8Array; the regression test uses an offset Buffer and verifies signed/unsigned integers. 58 unit/integration tests and the production build pass. The read-only live monitor passes with the registered project. This was a server/client decoder fix, not an onchain upgrade.

The public repository https://github.com/happycamper-stix/evangel-fund now contains source snapshots with provenance in commit messages. The pilot project `7nHAfLoBSaNe8UQJFqCP7np5eRwpVNk1hDBxr8wRPwHT` is registered on Devnet, not adopted. No identity, payout or reviewer acceptance is implied. Finalized registration receipt is in docs/PILOT_REGISTRATION.json.

## Hardening candidate and operational update — October 2

EV-01 remains open on the deployed Devnet binary. A local append-only `submitAdoptionCandidate` / `selectAdopter` candidate allows a wallet to seal exact terms in its own immutable PDA and lets quorum select that verified candidate despite an earlier claimant. Claims cannot churn the approval epoch; rejection advances it. Selection checks receipt ownership, canonical seeds, terms, nonce and notice state, and cannot replace adopted or challenged ownership. The governor requires fresh GitHub/wallet verification plus that acceptance receipt. This requires a separately reviewed Squads upgrade; it is not yet deployed.

EV-02 mitigation is configured: Vercel validated and published aggregate rule `rule_evangel_solana_aggregate_budget_eCLKaN`, 600 requests per 60 seconds for `/api/solana/`, without caller-controlled counting keys. The additional per-IP rule was rejected by the plan and was not installed. A controlled live threshold/enforcement test and operational alerting remain outstanding, so this finding is not declared fully closed. Invalid relay methods are now rejected before the cluster RPC lookup.

Validation: 59 local unit/integration tests pass, including candidate receipt substitution, unauthorized selection, epoch churn, stale approval, notice enforcement and the 1% token grant. 48 browser tests pass. Production web build passes; npm audit reports zero vulnerabilities. Cargo audit retains the known bincode unmaintained warning. The read-only Devnet monitor passes against the unchanged published deployment baseline. These tests do not prove absence of vulnerabilities.

## Venue adapter review — October 2 continuation

Reviewed implementation: `68df6f34d4ce1d764268c2c1bd8c610e3ed05516`. A separate local Rust adapter review build now implements atomic fixed-supply launch, exact 70% liquidity/30% reserve, sponsor-funded quote dust, permanent position custody, and authenticated quote-fee collection. The default website and custody deployment remain unchanged; no mainnet transaction or governance upgrade was submitted.

Validation: 65 unit/integration tests, 12 observed-venue tests and 48 browser checks pass. Venue tests execute the actual observed mainnet and Devnet DAMM binaries in LiteSVM, with both plain and immutable metadata-bearing dummy quotes. They cover positive buy/sell fees, protocol share, CPI balance-delta allocation, replay, unsolicited transfers, collection-day rollover, unpaid expenses, wrong accounts, altered fees/delegates/mint configuration, upstream deployment changes, atomic rollback and reserve release limits. The review build requires actual Squads governance; a separate local-only test build permits disposable test authorities. Tests are not public-chain acceptance receipts.

EV-02: a controlled live test produced exactly 600 HTTP 400 responses followed by 10 HTTP 429 responses in 13.2 seconds for unsupported RPC methods rejected before backend RPC. Threshold enforcement is verified for that route and window. The private repository now schedules read-only custody/website checks every 30 minutes. Alert delivery, sustained capacity and an operator response drill remain open; no claim of exhaustive denial-of-service protection is made.

EV-07 (release blocker): venue source-to-deployed-binary equivalence remains unverified. A local build with the documented Agave 3.1.10 toolchain differs from the observed executable. The local build environment differs from the reproducible Linux image, so this does not alone prove a source mismatch. The public verification service also reports no verified build. A digest-pinned Linux reproduction workflow is included to resolve this gate; successful instruction tests alone cannot close it.

Real production identity checks now include successful owner verification, rejection of a wrong wallet, and refusal to establish a role in an unrelated repository. Actual repository permission revocation remains a participant test. EV-01 remains open on the deployed binary until the existing adoption hardening is upgraded and exercised.

Reproduce the additional checks with `npm run test:venue:full`. See `docs/VENUE_ADAPTER_CANDIDATE.json`, `docs/DAMM_ADAPTER_SPEC.md` and `docs/LIVE_RATE_LIMIT_CHECK.json` for build identity and boundaries. The collector CLI refuses to sign without an explicit matching reviewed deployment baseline. Public launches remain disabled pending provenance, governance deployment and public pilot acceptance.

The production UI no longer exposes the legacy virtual-price input or legacy trade controls. Those controls are explicitly limited to the isolated development browser fixture; changing the launch flag alone cannot activate them in a production build. The new venue instruction builders are tested separately. The latest scheduled-monitor workflow completed successfully against the unchanged Devnet baseline and public website; notification delivery is still not claimed.

### EV-07 resolution for the observed mainnet executable

The digest-pinned Linux build completed successfully in workflow run `37085318407` from source commit `68df6f3`. Rebuilt Meteora source `a85c926607433f23f0ea60f4ca7b1ae92f4156cb` produced 1,433,928 bytes with SHA-256 `a30610058262a5c87e1b22144ef6053ff2cd8bc9f97b7e978a51e28f8ec3ea3c`. Those bytes exactly match the observed mainnet executable prefix; all remaining allocated bytes are zero. The downloaded artifact was compared again locally. See `docs/DAMM_VERIFIED_BUILD.json`.

EV-07 is resolved **for that observed mainnet binary and source revision**. The earlier macOS mismatch is historical. This verification is a reproducible-build check, not an independent audit, and does not cover future venue upgrades or establish Devnet source equivalence. Actual custody deployment, participant signatures and public-chain acceptance remain required.

# Resolution update — candidate v2, 2026-10-03

The inspection below is the historical review of v1, retained so the changes can be compared. It does not describe the latest candidate.

**Implemented since that inspection:** six-hour public challenge; separately built development fast mode requiring two inspections, a 14-day expiry and irreversible public activation; holder-voted recovery of proposer/reviewer keys with all new keys accepting; 30% quorum and strict two-thirds contested approval; production-release preflight; consolidated current fee documentation.

**Still requires real inputs/rollout:** voting mint and three reviewer identities, compatibility/distribution review, real participant rehearsal, exact authority migration and signatures, live voting UI/operations, and separate mainnet release. No authority or public funds moved. Direct wallet donations remain a separate unimplemented product feature.

See [current DAO rules](DAO_GOVERNANCE.md), [current economics](CURRENT_ECONOMICS.md), and [updated internal review](DAO_INTERNAL_REVIEW.md). Existing Squads and milestone delays remain unchanged.

---

# Evangel — pre-upgrade inspection

Prepared 2026-10-03. This is a review, not authorization to deploy, transfer authority, or release public funds. No upgrade was executed during this review.

## 1. What is actually active

Live `/api/solana/state` checked during this review: Solana **Devnet**, factory `testMode: true`, `launchEnabled: false`, one listed project, and a dummy quote mint. The website is publicly accessible, but production trading is not enabled.

- Factory program: `Ac4F5CNu8tYdUx4RZTKRchFyj5nZ9wG12eh3zDVJn7LV`.
- Factory authority / recorded upgrade authority: Squads vault `GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy`.
- Multisig: `4jiu9tuEWQueXfhPd6HwvVVzpZr2pvVrtrcEyMCb1VMh`.
- Existing recorded governance: 2-of-3 approvals, 48-hour delay. A new DAO policy does not change that existing setting.
- Current members: foundation `92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc`, `FqXojD69EQyiT1Vckz3twzMTUXNr4yL3Qe5kcroAV2GM`, and `5GcGNF4fTJhBiGLCqwXxFTj5tqWUjRAsGAmMvSMJ5sL4`.
- Live upgrade endpoint returns HTTP 503 with `governance-migration-required`. This blocks the website signing workflow, not the multisig members' underlying onchain authority.
- No mainnet release, DAO authority migration, or holder voting activation is established by these website changes.

Sources: live state/upgrade endpoints; [deployment record](DEVNET_ADDRESSES.json); [readiness record](READINESS_PROGRESS.json).

## 2. Latest governance decision versus implementation

| System | Latest intended rule | Actual status |
|---|---|---|
| Reviewed Devnet development upgrades | Immediate after required review approvals | Not implemented in DAO candidate; existing multisig still waits 48h |
| Transition to public governance | One-way; completed before public funds or token launch | No transition instruction or launch coupling implemented |
| Public upgrade challenge window | **6 hours** after review approvals | Local candidate and current candidate page still say **24 hours** |
| Escalated holder vote | 72 hours | Implemented in local candidate only |
| Reviewers | Two of three attest to exact code/report | Local candidate; new reviewer set not configured |
| Holder challenge threshold | 1% of fixed governing-mint supply | Local candidate default |
| Contested approval | 10% turnout, strict majority for upgrade | Local candidate; ties/insufficient turnout reject |
| Voting eligibility | Tokens escrowed 7 days before proposal creation | Local candidate; cannot infer eligibility from wallet balance |
| Developer autonomy | Ordinary repository/product work stays with developer | DAO executor only governs program upgrades; not arbitrary project decisions |

**Do not sign the current candidate as if it implements the six-hour/bootstrap design.** It does not. The earlier 24-hour test results remain evidence for that version only. Changing the window also changes vote opening, escrow unlocking and expiry boundaries, and requires fresh tests and a fresh binary hash.

The bootstrap phase must not depend on zero voters, zero deposits or low turnout. A future explicit development phase needs non-bypassable constraints and a permanent close before public use. Chain/launch enforcement needs inspection; a website flag alone cannot establish it.

## 3. Funding without a token

- A public repository can be registered without launching a token.
- Donors do not need GitHub verification. They need a wallet to sign a contribution.
- Owners/maintainers/contributors verify their GitHub relationship and wallet binding when claiming roles. Registration alone does not establish endorsement or ownership.
- Existing funding sends SOL into the project's governed milestone budget, not immediately into the owner's personal wallet.
- Sponsorship has a **24-hour donor refund window**. Afterward it can be settled into project funding.
- Repo-owner payroll must be declared owner work and pass milestone review; community bounties are for eligible workers.
- Direct, unconditional donations to a verified developer wallet remain **unimplemented**. That would be a separate payment path with different refund and custody behavior.
- Pilot limits in the custody code: 10 SOL lifetime project funding and 1 SOL per SOL milestone. These are pilot constraints, not a mainnet capacity promise.

Source: [platform flows](../components/solana/Platform.js), [custody program](../solana/program/src/lib.rs).

## 4. Project token rules

- Solana-native. Each launched project coin has **21 million tokens**, six decimals.
- **70%** is allocated to initial token-side liquidity/inventory; **30%** to the governed reserve.
- Initial owner/adoption release: **1% of total supply**, included within the developer's **20% lifetime maximum** and the first shared release window. It is not an extra allocation.
- Remaining **29%** is earned through milestones. At least **10% of total supply** is reserved for community/workers.
- Shared release ceiling: **1% of total supply per rolling 21 days**; this is not an automatic entitlement every 21 days.
- No mint authority or freeze authority after launch. Token-program supply protection differs from policies inside an upgradeable factory, which approved replacement code could change.
- All launch pairs target the existing e/acc mint `CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU`. Devnet uses a clearly identified dummy mint. No e/acc buy-and-burn.
- No developer-supplied quote liquidity is the launch objective. Actual buyer liquidity is still required; virtual quote balances are not real spendable assets. Production venue/mint compatibility remains gated.
- Evangel's public repository may participate as a project/token under the same rules. No actual Evangel mint has been selected or launched by changing that wording.

Source: [custody constants and launch logic](../solana/program/src/lib.rs), [venue candidate](VENUE_ADAPTER_CANDIDATE.json).

## 5. Fees and daily settlement

Approved target is **5% per buy and 5% per sell**, divided as percentages of gross trade value:

| Recipient | Gross trade share |
|---|---:|
| Venue protocol | 1.00% |
| Project development | 2.55% |
| Community contributors | 0.50% |
| Governance inference/API costs | 0.80% |
| Foundation | 0.15% |
| Total | **5.00%** |

The venue's 1% is included, not added on top. Evangel's net 4% receipt is split 63.75% / 12.5% / 20% / 3.75% respectively among development/community/governance/foundation.

- Development fees go to the adopted project owner without requiring a work milestone.
- Fees are booked on the **UTC day actually collected**, not the original trade day.
- At daily close, uncommitted governance funds and allocation dust go to that project's development budget.
- Approved but unpaid actual expense commitments remain reserved. No speculative invoice reservations or double reimbursement; no borrowing from other projects/community budgets.
- Contributor funds remain tied to approved work.
- Collection/settlement runner exists but the always-on signing service is not activated. Its last recorded dry run stopped at the undeployed venue adapter.

**Documentation conflict:** older paragraphs in CURRENT_ECONOMICS.md still mention 3% development / 1.35% governance and describe them as implemented. Those describe superseded fixture behavior, not today's target. Do not use those numbers for release approval. The source-of-truth target is [fee-policy.mjs](../lib/solana/fee-policy.mjs), with actual venue integration tested separately.

## 6. Milestones, disputes and identity

Owners propose scope, acceptance criteria, evidence, budget and deadline. The governance agent reviews for OSS relevance, fraud, duplicate payment and conflicts. Plan approval is not payout approval. Reviewers independently validate evidence; the agent has no signing keys.

Rejected/failed work can be reopened for another worker using the same allocation/criteria and a fresh work window. Payments remain constrained by reserve budgets, authorization, evidence and existing dispute stages.

**Separate clocks:** current milestone/adoption/reimbursement notice logic still uses two days; work windows use 21 days; sponsorship refunds use 24 hours. The requested six-hour change applies to the future **upgrade challenge window**, not every delay in the product.

GitHub login, wallet binding and repository verification provide provenance; they do not establish that work or an invoice is true. Review evidence is treated as untrusted input.

## 7. DAO candidate protections and limitations

Implemented locally: escrowed voting balances; duplicate-vote protection; locked withdrawals; two review attestations; exact buffer and base-program hashes; fixed target/treasury; stale proposal invalidation after another upgrade; cancellation; expiry; replay rejection; permissionless execution only after approval.

Outstanding:

1. Implement the six-hour window and explicitly bounded development phase/irreversible public transition.
2. Select the platform voting mint. Pairing against e/acc does not automatically make e/acc the voting asset. Project holders do not automatically control the shared factory.
3. Check mint compatibility: the guard currently accepts only extension-free, six-decimal Token-2022 mints with revoked mint/freeze authority. Existing project/e/acc mint compatibility cannot be assumed.
4. Select three distinct reviewer keys, all different from the proposer, and disclose real-world conflicts.
5. Address key loss and reviewer rotation before freezing the guard: candidate configuration has no recovery/rotation, so lost keys can permanently halt upgrades.
6. Review token concentration. A 20% holder can meet 10% quorum alone; distinct wallet counts do not solve that.
7. Integrate actual holder-facing deposit/challenge/vote transactions; the website currently publishes candidate rules and blocks the old upgrade, not a live DAO voting interface.
8. Review the authority migration and limits. The guard must be immutable before initialization and hold the target's upgrade authority before its votes become binding. Existing Squads authority remains until an authorized transfer.
9. Recognize that voters/reviewers could approve malicious replacement code. The guard verifies identity and procedure, not code correctness or permanent protection of all factory policies.

Source: [DAO rules](DAO_GOVERNANCE.md), [internal review](DAO_INTERNAL_REVIEW.md), [guard implementation](../solana/dao/src/lib.rs).

## 8. Evidence already available and release decision

Recorded for the **24-hour candidate**: seven compiled SBF scenarios, four native rule tests, 72 existing unit/integration tests, 50 browser checks, production website build and Clippy passed. Rust dependency scan reported an unmaintained bincode dependency warning. This is first-party review, not independent certification. These results do not test the unimplemented six-hour/development-phase design.

Before any replacement upgrade: resolve the mismatches above, publish the new diff/build hashes and findings, rerun affected tests, rehearse on Devnet with real participants, inspect exact addresses/authority transitions, and obtain the required signatures. Mainnet funding/trading, venue acceptance, scheduled operations, alerts and recovery remain separate rollout gates.

**Inspection recommendation: hold the upgrade.** Review this document first; then implement the agreed changes and prepare a fresh, inspectable candidate. No signature or upgrade execution is requested by this document.

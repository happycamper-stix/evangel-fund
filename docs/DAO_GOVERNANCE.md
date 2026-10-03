# Holder challenge governance — candidate v2

Status: e/acc-compatible guard is immutable on Devnet and initialized for a separate disposable target (DAO_DEVNET_REHEARSAL.json). Holder deposits and real-time voting rehearsal remain pending. The real factory has not migrated. See DAO_DEVNET_CANDIDATE.json. The factory still uses the existing Squads authority and recorded 48-hour delay. The old staged upgrade is superseded; its website signing and preparation paths remain blocked. No authority is transferred by publishing these rules.

## Decisions and scope

Ordinary product, repository and roadmap work stays with developers. This guard governs **program upgrades and recovery of its proposer/reviewer keys**. It cannot authorize treasury withdrawals, change fees, pay milestones, alter supply, change its voting mint, or acquire authority over another project. Those other systems retain their existing rules.

One immutable guard configuration binds one target program, voting mint, fixed supply denominator and rent-refund treasury. Proposer/reviewer keys can change only through the recovery process below. An Evangel project token is allowed, but its mint has not been selected or configured. e/acc pairing does not automatically make e/acc the platform governance token.

## Development and public phases

**Production build:** rejects development-mode initialization. From initialization, every upgrade needs inspection and the public six-hour challenge process. Its reviewed binary hash is distinct from the development build.

**Development-only build:** an explicitly selected configuration can execute immediately after two review attestations. Fast mode expires **14 days after initialization** and cannot be extended. It never infers development status from a lack of holders, deposits or votes.

The developer can permanently activate public rules earlier. After expiry, anyone can record that transition. Activation clears the deadline and increments the proposal generation, invalidating all outstanding approvals. There is no instruction that reopens development. At the deadline itself, old fast-approved proposals are invalid, even before someone records the explicit transition. New proposals then use public rules.

No public launch may use the development artifact. `assertDaoPublicRelease` checks the reviewed production hash, immutability, confirmed identities, explicit public state, and actual target authority. This is a release preflight, not an activated release pipeline. Solana programs do not supply a trustworthy genesis-hash syscall; the development binary must not be represented as cryptographically restricted to Devnet. Production release must pin the production artifact and review the actual authority migration. Public trading remains disabled.

## Public upgrade process

1. Developer proposes an immutable code hash, current executable hash, inspection-report hash and HTTPS evidence URL. Guard already controls the buffer, preventing external rewriting.
2. **Two of three distinct reviewers**, different from the developer key, attest to that exact proposal. Drafts expire for attestation after seven days. Distinct keys do not prove real-world independence.
3. Second attestation starts a **six-hour challenge window**.
4. Mature token holders can publish an evidence hash and coordinate support. **1% of the fixed supply** escalates the proposal. Support cannot be withdrawn or counted twice.
5. At the six-hour deadline, an escalated proposal opens a **72-hour approve/reject vote**. Challenge support is not automatically a reject vote.
6. Escalated approval requires **30% turnout and strictly more than two-thirds of votes cast in favor**. Exactly two-thirds, ties, insufficient turnout, or insufficient support reject it. No early tipping.
7. Unchallenged upgrades can finalize after six hours. Challenged upgrades cannot finalize before the full vote ends.
8. Execution is permissionless after approval, but expires seven days after the potential vote end. It rechecks exact buffer, target, code hash, base executable, treasury, generation and phase. A successful upgrade invalidates sibling proposals prepared for the old generation. Replay and stale fast approvals fail.

On a 21M mint, challenge support is 210,000 tokens and quorum is 6.3M. These example counts do not apply to the existing e/acc mint: its initialization supply must be measured and used as the denominator. The original maximum 20% founder allocation (4.2M) cannot satisfy quorum alone. This does **not** solve concentration in general: whales can buy additional tokens or coordinate, and key ownership cannot prove independence. Raising quorum reduces unilateral control but increases the chance low participation blocks upgrades. Publish concentration and participation analysis before activation.

## Voting custody

One base unit of escrowed tokens equals one voting unit. Tokens must be deposited **seven days before proposal creation**. This is mature escrow eligibility, not a snapshot of all wallet balances. Short-term borrowing is discouraged, not eliminated.

An active deposit cannot be topped up. Withdraw and redeposit to change its amount; maturity restarts. Per-proposal ballot PDAs prevent duplicate votes. Participants remain locked until six hours plus 72 hours after opening, even if a proposal is unchallenged or canceled. Unlock does not depend on operator finalization. Recovery proposers are also locked through that vote.

Voting mint support requires six-decimal Token-2022 with revoked mint and freeze authorities. Plain mints and the exact immutable, self-referencing MetadataPointer + TokenMetadata pair are accepted. Unknown, duplicate, truncated, mutable, externally referenced or transfer-affecting extensions fail closed. Token accounts may be plain or contain only ImmutableOwner; delegate, native and close authorities are rejected. The live e/acc mint passes this policy; see DAO_MINT_INSPECTION.json. The initialization supply is the fixed quorum denominator, so burns do not reduce thresholds.

## Key loss and recovery

Recovery replaces the developer key and all three reviewers as one explicitly named set. It cannot change the target, mint, supply, treasury, development deadline or public phase. It invalidates all outstanding approvals, so old signatures cannot carry over to a new committee.

**Public mode:** any holder with at least 1% mature escrow may propose recovery, including when old developer/reviewers are unavailable. The proposal includes a public evidence/report hash. It always gets a six-hour notice and full 72-hour vote, even without a challenge, and must satisfy the same 30% quorum/strict two-thirds majority. Old keys cannot cancel or veto recovery. Every proposed replacement key must sign acceptance before execution; a vote cannot accidentally install an inaccessible wallet.

**Development mode:** developer or a current reviewer may propose recovery. Two current reviewers must attest, and every replacement key must accept. There is no single-key reset. If reviewer quorum is lost before holders exist, a disposable development deployment may need replacement. Recovery cannot guarantee liveness if neither authorized reviewers nor sufficient holders can act.

Program upgrades still require inspection after a recovery. Recovery itself can use holder approval without old reviewer signatures; otherwise lost reviewer keys could prevent their own replacement. That is a deliberate, disclosed governance trust boundary.

## Inspection requirements

The report must identify the source commit/diff, toolchain and lockfile hashes, old/new binaries, account-layout compatibility, effects on custody/supply/authority, security findings, test evidence, recovery plan, and reviewer conflicts. Reviewers verify document bytes against its hash before signing. The agent prepares analysis but has no signing keys. A cryptographic attestation proves who signed and what was authorized, not the quality of their inspection.

The guard itself must be immutable before initialization. Target loader authority must move to its PDA before voting is binding. Approved malicious replacement code can still change the target's internal policies; an upgradeable program cannot promise all its rules are immutable.

## Activation still requires real inputs

- Explicit choice and verified address of the platform voting mint.
- Proposer, three independent reviewer public keys, and fixed treasury.
- Actual mint compatibility and distribution checks.
- Published review of the final production artifact, real Devnet participant rehearsal, and exact authority-migration inspection/signatures.
- Existing Squads migration still obeys its current delay. No client setting overrides it.
- Holder-facing deposit/challenge/vote UI and live adapter remain unactivated. Instruction builders and account decoders are available for rehearsal; no live DAO is claimed.
- Public funding/venue/operations gates and separately authorized mainnet release remain required.

## Implementation

`solana/dao/src/lib.rs`, `lib/solana/dao.mjs`, `lib/solana/dao-release.mjs`, `tests/dao/`, and [internal review](DAO_INTERNAL_REVIEW.md).

Run `npm run test:dao` for both build variants and compiled-program/release tests; `npm run test:dao:rules` for Rust boundaries. Development output is `.evangel/dao-development`; production candidate output is `.evangel/dao-programs`. Neither command deploys.

Reference: [Realms SPL Governance](https://docs.realms.today/developer-resources/spl-governance) describes locked-token governance. This custom optimistic guard is not Realms and does not inherit its audit.

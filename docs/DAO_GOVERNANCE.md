# Holder challenge governance — candidate v1

Status: locally implemented upgrade guard; not deployed or activated. The currently deployed factory still uses Squads 2-of-3 and its existing 48-hour delay. The old staged upgrade is superseded and the website signing endpoint is blocked. A website change cannot revoke the current signers' onchain powers.

## Authority and scope

Developers keep ordinary product, repository, and roadmap decisions. The first enforceable DAO module covers **program upgrades**, not arbitrary treasury withdrawals, fee changes, or milestone votes. Existing milestone/reward review and custody rules remain in force. Expanding voting to those actions requires a separately reviewed executor; it is not implemented by this release.

Each guard configuration binds exactly one target program, one voting mint, one developer proposer, three reviewer keys, and a fixed buffer-rent refund treasury. A project token does not control another project's program. Evangel's shared factory needs an explicitly selected and verified platform voting mint; no address is inferred from a ticker. e/acc pairing does not automatically grant e/acc holders platform voting rights.

## Rules

- Voting units are actual escrowed tokens, not signatures or self-reported balances. One base unit = one vote. There is no wallet-count quorum or quadratic weighting that can be bypassed by splitting wallets.
- Voting mint must be initialized, six decimals, Token-2022 with **no extensions**, and have neither mint nor freeze authority. Extension-bearing tokens are rejected until compatibility is separately implemented and tested. The fixed supply read at initialization is the denominator; burning tokens does not lower thresholds.
- Deposit at least **7 days before proposal creation** to be eligible. No top-ups while a deposit is active. Withdraw and redeposit to change it; maturity restarts. This is mature escrow eligibility, not a historical snapshot of all wallet balances. It discourages short-term borrowing but does not eliminate bribery or longer-term borrowing.
- The developer publishes an immutable code hash, base executable hash, inspection-report hash, and HTTPS evidence URL. The buffer is already controlled by the guard, so its code cannot be rewritten externally.
- **Two of three reviewers** attest to the same proposal. Reviewer keys must be distinct and different from the developer key. This checks keys, not real-world independence. The agent may prepare analysis; it cannot sign an attestation.
- The **24-hour challenge window begins with the second attestation**, not proposal creation. An unreviewed draft cannot execute and expires for attestation after seven days.
- A holder submits a SHA-256 evidence reference; supporters coordinate against the same proposal. Their locked voting weight aggregates. **1% of the fixed mint supply** triggers escalation. A challenge is irrevocable for that proposal; support cannot be counted twice.
- When the 24-hour window ends, a qualifying challenge opens a **72-hour vote**. Challenge support is not automatically a reject vote: holders explicitly vote approve/reject once each.
- A challenged change requires **10% turnout and strictly more approve than reject votes**. A tie or insufficient turnout rejects it. No early vote tipping.
- Without a qualifying challenge, anyone can finalize approval after the full 24 hours. With one, finalization must wait until the full vote closes.
- Participation locks tokens through the end of the potential 72-hour vote. Unlocking is time-based and does not rely on an operator finalizing the proposal. Unchallenged/canceled proposals conservatively retain that same four-day participation lock.
- Only the developer can cancel, and cannot edit an existing proposal. Amendments create a new proposal and require fresh inspections and a new challenge period.
- Approved execution is permissionless but expires seven days after the potential vote end. Execution checks exact target, buffer hash, base executable hash, authority PDA, treasury and proposal generation. Any successful upgrade invalidates sibling proposals from the prior generation, including identical-code proposals. Replay and substituted code are rejected.

For a 21M token: challenge threshold 210,000; voting quorum 2.1M. These are initial defaults, not evidence that a token has a decentralized distribution. A holder with 20% can meet quorum alone. Before production, publish concentration and participation analysis; do not market this as protection from a controlling voting bloc.

## Inspection evidence required

The report identified by the proposal hash must contain: source commit and diff, build/toolchain and lockfile hashes, candidate and current binary hashes, compatible account layouts/migration evidence, supply/custody/authority impact, security review findings and resolutions, executable test results, operational recovery plan, and reviewer identities/conflicts. Reviewers verify report bytes against the hash before attesting. The program proves attestations and code identity; it cannot prove that a review was competent or that claims in a report are true.

## Why a separate guard

The guard's own loader authority must be **None before initialization**. Otherwise its administrator could replace the voting code to bypass a veto. The target program's loader authority must subsequently move to the guard PDA through the existing authorized migration. An upgradeable factory cannot impose unchangeable rules on its own future upgrades; holder/reviewer approval remains a trust boundary. Approved malicious code could still change the factory's rules. Supply without mint authority remains enforced by the token program.

This first version deliberately has no administrator override, arbitrary CPI, key rotation, or emergency treasury seizure. Immutable configuration means lost developer/reviewer keys can permanently halt upgrades. Review this recovery tradeoff before any authority transfer; do not make the guard immutable on a live deployment until its review and recovery policy are accepted.

## Rollout gates

1. Confirm the voting mint and three reviewer public keys, and disclose token concentration. No secret keys are requested.
2. Complete internal inspection and publish the reviewed artifact hashes. The guard is new custom code, not an independently audited Realms deployment.
3. Deploy a disposable Devnet guard and test mint. Reproduce local adversarial tests with actual participants. Never reuse a dummy mint as the mainnet mint.
4. Inspect an explicit authority-migration proposal. The existing Squads 48-hour rule still applies to that migration; the new 24-hour window does not retroactively shorten it.
5. Verify the guard's immutability, exact configuration, and factory upgrade authority before enabling a holder-facing signing UI.
6. Prepare a fresh factory proposal with two inspections and the 24-hour challenge window. Do not execute the superseded venue-only proposal.
7. Run unchallenged/challenged/tied/no-quorum/expired/canceled/stale proposal acceptance tests, plus funding and venue gates. Mainnet remains disabled and separately authorized.

## Implementation and testing

- `solana/dao/src/lib.rs`: immutable configuration, Token-2022 escrow, review attestations, challenges, ballots, finalization and loader CPI executor.
- `lib/solana/dao.mjs`: instruction encoders, PDA derivation and account decoders. Low-level tools do not imply deployment or an enabled website ballot flow.
- `tests/dao/upgrade-guard.test.mjs`: real compiled SBF in LiteSVM, including loader execution and malicious attempts. Test account creation/authority changes are disposable VM fixtures only.
- `npm run dao:build`, `npm run test:dao`, `npm run test:dao:rules`.

Reference consulted: [Realms SPL Governance](https://docs.realms.today/developer-resources/spl-governance) documents token deposits, locked voting balances, proposals and executable transactions. Evangel's optimistic challenge guard is a separate implementation, not Realms or its audit.

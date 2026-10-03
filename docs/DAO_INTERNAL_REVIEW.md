# DAO upgrade guard — candidate v2 internal review

Date: 2026-10-03. This is a first-party engineering review, not independent certification or a claim of exploit immunity. No live guard deployment, authority transfer, or public voting is claimed.

## Artifacts

- Production guard: 149312 bytes; SHA-256 `8a788146144f9d6ec4392046ebfe7910231a716d0977a04f5db919afee2f37d6`. Rejects fast-mode initialization.
- Development-only guard: 149360 bytes; SHA-256 `d12ee50bc69d63f5f6cc05620006bf8ff5dd121514f6acdcb59b3542efed4691`. Fast mode must be explicitly initialized, expires after 14 days, and cannot be reopened.
- Machine-readable record: DAO_RELEASE_CANDIDATE.json. Candidate addresses, mint and reviewers are not invented or populated.

## Resolved findings

- Replaced the old 24-hour candidate with six-hour public notice/challenge and a separate 72-hour escalated vote. All unlock/finalization/expiry calculations use the same challenge constant.
- Added one-way public activation and automatic end of development fast mode. Phase and generation binding invalidate previously fast-approved proposals after transition/expiry.
- Production artifact cannot initialize development mode. Public-release preflight checks artifact hash, explicit public state, immutability, confirmed keys/mint and target authority. This helper is not a deployed release pipeline; inspect the actual migration before accepting it.
- Replaced permanent key-loss deadlock with mandatory holder-voted public recovery. Every new developer/reviewer key must accept. Recovery cannot modify treasury, mint, target or development status and invalidates outstanding approvals. Current keys cannot cancel public recovery.
- Development recovery needs two current reviewer attestations plus new-key acceptance; there is no one-key reset.
- Raised contested/recovery quorum to 30% and approval to strictly more than two-thirds. The original 20% founder allocation cannot reach quorum alone. Do not describe this as eliminating whales, collusion or low-turnout risk.
- Consolidated fee documentation around 1% venue / 2.55% development / 0.5% community / 0.8% governance / 0.15% foundation.

## Verification

- 13 compiled SBF scenarios plus one release-preflight test pass. Coverage includes actual loader CPI, exact six-hour boundary, reviewer quorum, mature escrow, duplicate votes/challenges, withdrawal locks, wrong code/base hash, stale generations, cancellation, expiry, other-wallet stake, mutable guard/mint/freeze authorities, production rejection of fast mode, development inspection and irreversible transition, deadline expiry, 20% concentration, public recovery, development recovery, invalid key sets and stale reviewer approvals.
- Five Rust boundary tests pass, including exactly two-thirds rejection and founder-sized turnout rejection.
- Existing 72 unit/integration tests and 50 browser checks pass. Next production build passes.
- Clippy with all features and warnings denied passes.
- Dependency audit retains one unmaintained bincode 1.3.3 warning (RUSTSEC-2025-0141) in Solana dependencies; no vulnerability errors reported. Track upstream resolution rather than changing consensus serialization casually.
- Tests simulate disposable accounts and authority transitions in LiteSVM. They do not prove that a real participant has reviewed or signed a live proposal.

## Limits still requiring inspection

- Voting mint, reviewer identities/conflicts, and actual mint compatibility are not selected. The current guard accepts only extension-free six-decimal Token-2022 with revoked mint/freeze authority. Unsupported mints fail closed.
- Higher quorum can cause governance deadlock when participation is low. Holders with more than the original founder allocation can still dominate. Key recovery requires enough eligible participation; it does not recover a community with no available quorum.
- The program cannot cryptographically identify Devnet. Development artifact selection must be prevented at public release using a pinned production hash and authority inspection; never advertise development bytes as network-restricted onchain.
- An approved target upgrade can change target-program policies. Review/vote enforcement does not prove new code correctness or make all factory caps permanently immutable.
- Configuration ABI changed from v1, which was never deployed. No funded v1-account migration is provided.
- Existing custody remains Squads-controlled and its 48-hour delay remains in force. Old signing/preparation remains blocked; a website block does not revoke signers' onchain authority.
- Live holder signing UI, real Devnet rehearsal, final artifact inspection, authorized migration, operating-service and venue acceptance remain separate activation gates. Direct-wallet donations are not part of this guard release.

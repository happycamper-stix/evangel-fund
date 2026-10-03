# DAO upgrade guard — candidate v3 internal review

Date: 2026-10-03. This is a first-party engineering review, not independent certification or a claim of exploit immunity. A separate mutable candidate is deployed and bytecode verified on Devnet (DAO_DEVNET_CANDIDATE.json). No initialization, authority transfer or public voting is claimed.

## Artifacts

- Production guard: 152816 bytes; SHA-256 `9c700378cb2956556b1d1360d078c1c8846cb89167024335b85a6fd427f047a9`. Rejects fast-mode initialization.
- Development-only guard: 152872 bytes; SHA-256 `e177cb113330814324a5d0af6dad64c4a1a803f5972cb21f894cbb6d6f0a1ad6`. Fast mode must be explicitly initialized, expires after 14 days, and cannot be reopened.
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

- Voting mint, reviewer identities/conflicts, and actual mint compatibility are not selected. The guard accepts plain six-decimal Token-2022 or immutable self-contained MetadataPointer + TokenMetadata with revoked mint/freeze authorities. The live e/acc mint passes raw inspection. Plain and ImmutableOwner token accounts pass; unknown extensions fail closed.
- Higher quorum can cause governance deadlock when participation is low. Holders with more than the original founder allocation can still dominate. Key recovery requires enough eligible participation; it does not recover a community with no available quorum.
- The program cannot cryptographically identify Devnet. Development artifact selection must be prevented at public release using a pinned production hash and authority inspection; never advertise development bytes as network-restricted onchain.
- An approved target upgrade can change target-program policies. Review/vote enforcement does not prove new code correctness or make all factory caps permanently immutable.
- Configuration ABI changed from v1, which was never deployed. No funded v1-account migration is provided.
- Existing custody remains Squads-controlled and its 48-hour delay remains in force. Old signing/preparation remains blocked; a website block does not revoke signers' onchain authority.
- Live holder signing UI, real Devnet rehearsal, final artifact inspection, authorized migration, operating-service and venue acceptance remain separate activation gates. Direct-wallet donations are not part of this guard release.

## v3 e/acc compatibility review

The parser accepts exactly extension IDs 18/19, each once, with zero update authorities and both addresses bound to the mint. Complete metadata Borsh decoding prevents trailing or malformed contents. No metadata content is treated as governance instruction. Token account extension ID 7 is the only accepted account extension. Transfer fees, hooks, delegates, native accounts and close authorities are rejected. The existing 165-byte escrow remains valid for metadata-only mints; compiled Token-2022 CPI tests verify both deposit and withdrawal from 170-byte ImmutableOwner accounts using the real e/acc mint layout.

21 DAO tests pass including raw snapshot validation, every extended-layout truncation, mutable/foreign/duplicate/unknown metadata and unsafe token account rejection. The real mint exists on mainnet; development-network tests use isolated accounts and do not claim a mainnet governance deployment.

Reference: https://solana.com/docs/tokens/extensions/metadata and the installed @solana-program/token-2022 generated extension discriminators (18 MetadataPointer, 19 TokenMetadata, 7 ImmutableOwner).

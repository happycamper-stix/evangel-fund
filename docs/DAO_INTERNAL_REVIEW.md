# DAO upgrade guard — first-party implementation review

Date: 2026-10-03. Scope: `solana/dao`, client codecs, legacy-upgrade hold. This is an internal engineering review, not independent certification or a claim of exploit immunity.

## Evidence

- Compiled SBF candidate: `.evangel/dao-programs/evangel_dao.so`, 134512 bytes.
- SHA-256: `3ff1e41b967978612a8a5fcb3af3321dc0255ba8fd4f52552bdeb88a8d4b0448`.
- Seven real-SBF LiteSVM scenarios pass: review quorum/delay/loader upgrade/replay; escrow maturity/duplicate challenge/withdraw lock/no quorum; affirmative quorum/buffer substitution; other-wallet stake/cancel/expiry; mutable guard and mint/freeze authority rejection; stale sibling proposal; changed base executable.
- Four native Rust rule tests pass: 24-hour boundary, challenged voting deadline, ties/insufficient turnout, threshold/overflow boundaries.
- Existing 72 unit/integration tests and 50 browser checks pass; Next production build passes.
- `cargo clippy -- -D warnings` passes.
- `cargo audit --file solana/dao/Cargo.lock`: no vulnerability errors; one **unmaintained bincode 1.3.3** warning (RUSTSEC-2025-0141) in Solana dependencies. Track upstream resolution; do not replace Solana's serialization dependencies without compatibility review.

## Findings addressed during implementation

1. Parallel approved proposals could otherwise roll a newer deployment back: bind the base executable digest and configuration generation; increment the generation atomically with successful execution.
2. A mutable guard could bypass votes: initialization requires its own loader ProgramData to be immutable. This is a rollout requirement, not a live authority change performed here.
3. A token holder could reuse transferred tokens: escrow is real Token-2022 custody, matures before proposal creation, and stays locked through the potential voting deadline. Per-proposal ballot PDAs prevent duplicate votes/challenge weight.
4. Post-review buffer changes could substitute code: the buffer authority is the guard PDA before proposal creation and the binary digest is rechecked at execution. No buffer-write/close/authority-change instruction is exposed by the guard.
5. The old website still offered an unrelated staged upgrade: the API now returns a fail-closed migration hold, preparation script refuses, and baseline promotion with `--write` refuses. Existing onchain Squads authority still exists and cannot be revoked by website code.
6. Hashing staged and current program bytes exceeds Solana's default 200k compute budget for the fixture: clients provide an explicit 600k budget using `daoComputeBudget`; tested loader execution succeeds within it. Recheck the budget for the final candidate size.

## Unresolved activation gates / limits

- No platform voting mint selected/verified, no immutable guard deployed, no authority migration executed, and no holder-facing transaction UI activated. Low-level instruction builders are implemented; their existence is not a live DAO.
- Three reviewer identities, proposer key and refund treasury require explicit configuration and conflict disclosure. Distinct keys cannot prove independent humans.
- Token concentration can give a large holder decisive power. Initial 1% challenge / 10% turnout thresholds require distribution and participation review before production.
- No recovery/key-rotation pathway in this version. Loss of the developer key or enough reviewer keys can halt upgrades permanently; evaluate this tradeoff before freezing or transferring authority.
- Extension-bearing voting mints are unsupported and fail closed, including metadata extensions. Existing project mints must be checked; they are not automatically compatible.
- Only program upgrades are enforced by this guard. Arbitrary project proposals, fee changes, payroll, milestone challenges and existing Squads custody do not become holder-governed through this implementation.
- Approved malicious code can still change target-program policy; a mutable target cannot promise immutable internal caps. The guard enforces review/vote/code identity, not correctness of new code.
- Local tests use disposable minted balances and loader account fixtures. Real participant Devnet rehearsal, independent evidence inspection, custody/venue acceptance, operations/recovery, and separately authorized mainnet deployment remain outstanding.

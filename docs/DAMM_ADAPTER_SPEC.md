# DAMM v2 integration decision

Decision: investigate a direct one-sided DAMM v2 pool using the existing project mint. Do not use DBC graduation to hold Evangel's 30% reserve. This is a pinned integration specification, not a completed or audited adapter.

## Evidence checked October 2, 2026

Meteora source revision `a85c926607433f23f0ea60f4ca7b1ae92f4156cb`, program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.

- [`utils/token.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/utils/token.rs) accepts MetadataPointer and TokenMetadata permissionlessly. The finalized live e/acc inspection in `EACC_MINT_INSPECTION.json` has only these extensions, with null mint/freeze/metadata authorities. This resolves the *mint extension* concern against this source revision, not binary provenance or pool safety.
- [`constants.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/constants.rs) sets protocol fee to 20% of the trade fee. A 5% trade fee yields 4% net LP fees before integer rounding. The approved net allocator remains 255/400, 50/400, 80/400, 15/400.
- [`ix_permanent_lock_position.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/instructions/ix_permanent_lock_position.rs) locks position liquidity; [`ix_claim_position_fee.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/instructions/ix_claim_position_fee.rs) separately claims accrued fees using position authority. These capabilities need integration tests together.

## Required atomic launch

Mint 21M once at six decimals, place 14.7M into the base-only position and 6.3M into the existing governed reserve; verify balances after CPI. Set initial price at the one-sided range boundary so quote liquidity is zero. The venue nevertheless requires a transfer of one quote base unit as proof of ownership: 0.000001 e/acc at six decimals. A developer-free launch requires a platform-funded dust source; until that source is configured, reject the launch. Do not describe this as a zero-quote transfer. Price/range parameters need an explicit bounded policy and user-visible quote; do not invent a promised market value. The integer planner now selects the smallest liquidity value whose rounded deposit is exactly 14.7M; invalid or unrepresentable ranges fail closed. This still needs enforcement inside custody.

Use the project token as A, e/acc as B, quote-only `OnlyB`, a constant 5% scheduler and disabled dynamic fees/compounding. Validate actual pool state after initialization, not caller-supplied JSON. Program ID, canonical pool/position PDAs, vault owners/mints, mint programs and position NFT custody must be checked. Restrict the NFT owner to a factory-derived PDA with no generic delegate, transfer, remove-liquidity or arbitrary CPI instruction. Permanently lock the full initial position in the same atomic flow. Revoke mint/freeze authorities before success. Retain the existing reserve release limits independently of venue state.

## Fee ingestion and daily close

Only a restricted factory CPI may claim fees for its recorded canonical position into its quote custody account. Measure before/after token balances around that CPI and allocate only the actual positive delta, using checked cumulative net receipt arithmetic. Do not accept arbitrary caller amounts, logs, offchain signatures or an unrelated token transfer as proof of venue fees. Repeated claims must not re-credit the same amount. Validate pool configuration and position binding on every claim.

Approved October 2: fees are booked to the UTC day Evangel actually collects them. A delayed claim credits the collection day, never reopens or backdates a closed trade day. The onchain adapter must derive that day from Clock and bind the destination FeeDay PDA to it. The pure accounting model in `fee-policy.mjs` rejects backdated receipts and overflowing cumulative totals; it does not authenticate a CPI or enable trading. On a successful daily close preserve incurred, approved unpaid commitments, then send unused governance and dust to that project's development budget. Keep existing fixed recipients and community segregation.

## Remaining execution work

1. Verify the deployed venue binary against pinned source and record its loader/upgrade authority on the selected cluster.
2. Build and test CPI account mappings, exact fee serialization, one-sided price/range math and full-liquidity locking against that binary.
3. Implement the versioned Rust adapter and canonical balance-delta receipt accounting; do not change legacy fixture weights and call it integrated.
4. Run adversarial real-binary tests: account substitution, unlocked positions, unauthorized NFT delegates, excessive fees, altered mint extensions, overflow, replay, claim failure and atomic rollback.
5. Reviewer-approved Devnet upgrade/deployment, full launch/trading/settlement pilot, published first-party security review with explicit limitations, then a separately authorized capped mainnet release.

## Observed-binary tests — October 2 continuation

`DAMM_VENUE_INSPECTION.json` records the finalized mainnet program observation, loader, upgrade authority and executable SHA-256. The venue is upgradeable. Source-to-binary equivalence has **not** been established. No mainnet transaction was submitted.

Run `npm run solana:inspect-venue` to fetch the currently deployed executable only if it matches the committed observation, then `npm run test:venue`. An upstream binary change fails closed. `--observe` explicitly replaces the observation and requires review plus a corresponding test pin update; it never enables the adapter.

The observed executable runs locally in LiteSVM using disposable mints. Tests cover exact 70% base deposit, one-unit quote deposit, zero-quote failure with atomic rollback, unauthorized lock rejection, full permanent lock, repeat-lock rejection, and a zero-accrual fee claim after locking. These are real venue-program instructions, but not an Evangel CPI integration, actual e/acc extension execution, swap economics test, or positive-fee settlement proof.

`lib/solana/damm-plan.mjs` supplies checked integer planning, canonical address construction, fixed 5% fee serialization and lock instruction encoding. Its `adapterEnabled` remains false. No deployed custody program or launch flag changes in this step.

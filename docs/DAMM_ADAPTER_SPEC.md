# DAMM v2 integration decision

Decision: investigate a direct one-sided DAMM v2 pool using the existing project mint. Do not use DBC graduation to hold Evangel's 30% reserve. A local Rust integration and separate governance-enforcing review build now exist. Neither is deployed; this is not an independent audit or production approval.

## Evidence checked October 2, 2026

Meteora source revision `a85c926607433f23f0ea60f4ca7b1ae92f4156cb`, program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.

- [`utils/token.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/utils/token.rs) accepts MetadataPointer and TokenMetadata permissionlessly. The finalized live e/acc inspection in `EACC_MINT_INSPECTION.json` has only these extensions, with null mint/freeze/metadata authorities. This resolves the *mint extension* concern against this source revision, not binary provenance or pool safety.
- [`constants.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/constants.rs) sets protocol fee to 20% of the trade fee. A 5% trade fee yields 4% net LP fees before integer rounding. The approved net allocator remains 255/400, 50/400, 80/400, 15/400.
- [`ix_permanent_lock_position.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/instructions/ix_permanent_lock_position.rs) locks position liquidity; [`ix_claim_position_fee.rs`](https://github.com/MeteoraAg/damm-v2/blob/a85c926607433f23f0ea60f4ca7b1ae92f4156cb/programs/cp-amm/src/instructions/ix_claim_position_fee.rs) separately claims accrued fees using position authority. These capabilities need integration tests together.

## Required atomic launch

Mint 21M once at six decimals, place 14.7M into the base-only position and 6.3M into the existing governed reserve; verify balances after CPI. Set initial price at the one-sided range boundary so quote liquidity is zero. The venue nevertheless requires a transfer of one quote base unit as proof of ownership: 0.000001 e/acc at six decimals. A developer-free launch requires a platform-funded dust source; until that source is configured, reject the launch. Do not describe this as a zero-quote transfer. Price/range parameters need an explicit bounded policy and user-visible quote; do not invent a promised market value. The integer planner now selects the smallest liquidity value whose rounded deposit is exactly 14.7M; invalid or unrepresentable ranges fail closed. Custody now checks the actual source balance delta and reserve remainder in the same atomic instruction.

Use the project token as A, e/acc as B, quote-only `OnlyB`, a constant 5% scheduler and disabled dynamic fees/compounding. Validate actual pool state after initialization, not caller-supplied JSON. Program ID, canonical pool/position PDAs, vault owners/mints, mint programs and position NFT custody must be checked. Restrict the NFT owner to a factory-derived PDA with no generic delegate, transfer, remove-liquidity or arbitrary CPI instruction. Permanently lock the full initial position in the same atomic flow. Revoke mint/freeze authorities before success. Retain the existing reserve release limits independently of venue state.

## Fee ingestion and daily close

Only a restricted factory CPI may claim fees for its recorded canonical position into its quote custody account. Measure before/after token balances around that CPI and allocate only the actual positive delta, using checked cumulative net receipt arithmetic. Do not accept arbitrary caller amounts, logs, offchain signatures or an unrelated token transfer as proof of venue fees. Repeated claims must not re-credit the same amount. Validate pool configuration and position binding on every claim.

Approved October 2: fees are booked to the UTC day Evangel actually collects them. A delayed claim credits the collection day, never reopens or backdates a closed trade day. The onchain adapter must derive that day from Clock and bind the destination FeeDay PDA to it. The pure accounting model in `fee-policy.mjs` rejects backdated receipts and overflowing cumulative totals; it does not authenticate a CPI or enable trading. On a successful daily close preserve incurred, approved unpaid commitments, then send unused governance and dust to that project's development budget. Keep existing fixed recipients and community segregation.

## Implementation and evidence

Append-only opcodes `launchVenue` (34) and `collectVenue` (35) are implemented in the local Rust candidate. Launch creates the project mint and custody accounts, mints 21M once, reserves 30%, transfers exactly 70% into the canonical venue pool, permanently locks the full position, and revokes mint/freeze authority. A separately signing sponsor supplies one quote base unit. The payer receives only temporary, exact-deposit token delegation for the venue's transfer convention; delegation is revoked before return and never touches the reserve. Failure rolls back all creation, transfer and delegation changes.

Collection validates the recorded venue deployment tuple, canonical pool/position/NFT/vault bindings, immutable metadata allowlist, constant fee settings and fully locked position before and after CPI. It claims into project-owned custody, measures the actual positive quote balance delta, then transfers exactly that delta to today's fee vault. Unrelated transfers and previous claims cannot increase revenue. An appended byte in previously zero-padded FeeDay accounts selects policy 1 (255/400, 50/400, 80/400, 15/400); policy 0 retains historical fixture accounting. Daily surplus leaves approved unpaid commitments reserved.

Read-only observations are in `DAMM_VENUE_INSPECTION.json` and `DAMM_DEVNET_INSPECTION.json`. Both programs are upgradeable. Runtime checks pin their program-data address, loader, deployed slot, allocation length and upgrade authority; tests additionally hash-check the full observed executable. The observed mainnet executable now matches the pinned source through the digest-pinned Linux build in DAMM_VERIFIED_BUILD.json, including zero allocation padding. Devnet source equivalence is not claimed. An upstream upgrade deliberately blocks the adapter until a reviewed Evangel update.

Tests execute actual observed mainnet and Devnet binaries locally in LiteSVM, with plain and immutable metadata-bearing dummy quotes. They cover exact supply/reserve/deposit, separate sponsorship, 5% buys/sells and 20% protocol share, permanent lock, positive fee collection, repeat collection, unrelated deposits, collection-day rollover, outstanding expenses, upfront grant/release limits, wrong accounts, changed fees, delegation, altered mint configuration, changed deployment, and atomic rollback. They do not constitute public-chain receipts or a real e/acc trade.

## Build separation and reproduction

- `npm test`: default custody and legacy test fixture; default trading remains disabled.
- `npm run test:venue:full`: fetch only hash-matching venue observations, compile the isolated candidate and governance-enforcing review build, and run venue tests.
- `--venue-candidate`: isolated local tests may omit multisig; never deploy this build.
- `--venue-adapter`: separate `.evangel/venue-release` review artifact, requires actual Squads governance, keeps legacy trading disabled, and still requires test mode/dummy quote. No deployed baseline is overwritten.
- `npm run solana:collect-fees`: dry run requiring an explicit reviewed venue deployment baseline. `--broadcast` additionally requires matching deployed bytes and a development-network signer. Each signed attempt is journaled by signature. Collection and settlement remain separate permissionless operations.

The public launch flag stays false. Client instruction builders exist; the public signing flow, sponsored-dust service and recurring collection must be acceptance-tested against the reviewed deployment before activation.

## Remaining release gates

1. Recheck the current venue against DAMM_VERIFIED_BUILD.json immediately before deployment; a code change invalidates that evidence.
2. Review the new adapter and upgrade artifact, obtain actual 2-of-3 reviewer signatures, and respect the onchain delay. No upgrade occurred in this work.
3. Complete public Devnet launch/trade/collection/settlement and the real OSS participant pilot with finalized receipts.
4. Bind the public UI and scheduled signer service to the accepted deployment, test recovery and notification delivery, then separately authorize a capped mainnet release.

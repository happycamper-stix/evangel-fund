# Devnet deployment — October 2, 2026

The active development network is now **Solana Devnet**. No mainnet support was enabled.

## Network selection

`NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER` accepts only `devnet` (default) or `testnet`. Set it consistently at build and runtime and rebuild the website when changing networks. Server RPC overrides are separate: `SOLANA_DEVNET_RPC_URL` and `SOLANA_TESTNET_RPC_URL`. Every deployment and configured state read verifies the selected network's genesis hash; a custom URL cannot silently redirect execution to mainnet.

Wallet Standard chain IDs, explorer links, API configuration and operator tools use the same network selector. Local artifacts are isolated under `.evangel/solana-devnet` and `.evangel/solana-testnet`. The existing test-only Keychain identity is intentionally reused so the already-funded payer remains accessible on Devnet. Historical Keychain service/derivation labels are not network routing configuration and must not be renamed without a key migration.

## Verified on Devnet

- Funded payer: `HJQv3jt9yMhxhKkUyzN1Csj3w3FxJ2ASfU9q8C26RDpb`; initially 10 devnet SOL.
- Squads v4 program is executable and its program configuration is owned by Squads.
- Token-2022 program is executable.
- Dummy e/acc mint created: `DSivHUw3Bq8asXrGpkFm3ZLfQX9buZtzuTb9cxQYBmRb`. Mint and freeze authorities are null. This is a test asset, not the actual mainnet e/acc token.
- Custody deployment preflight: 220,600-byte program; conservative funding target 3.463661040 devnet SOL. Remaining balance after fixture creation exceeds that target.

## Factory deployed

The factory is deployed at `Ac4F5CNu8tYdUx4RZTKRchFyj5nZ9wG12eh3zDVJn7LV`. Governance multisig `4jiu9tuEWQueXfhPd6HwvVVzpZr2pvVrtrcEyMCb1VMh` contains the foundation and both user-supplied reviewers, with threshold 2 and a 172800-second delay. Factory authority and program upgrade authority both equal vault `GqMSNe6TuhP1KgZontrDAhr4JCwe7FohiRHDBMUFuURy`. The invariant monitor returned no alerts. Public addresses and build hash are recorded in DEVNET_ADDRESSES.json. Human independence of signers is not proven by onchain addresses.

Production Clerk, trading adapter, updated onchain fee accounting, actual e/acc support and independent audit remain separate outstanding release gates. Network migration does not complete them.

To return to testnet later, explicitly set `NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER=testnet`, configure the matching program and multisig addresses, rebuild/redeploy, and rerun genesis/deployment checks. Do not reuse a Devnet deployment journal as evidence of Testnet deployment.

## Validation

48 unit/integration tests passed; 44 desktop/mobile browser checks passed, including wallet requests using `solana:devnet`. Production build passed. Live Devnet fixture creation finalized and the deployment preflight verified funding. Factory initialization and upgrade-authority transfer completed and were verified on Devnet. A full reviewer-signed milestone/payout pilot remains pending.

## Reviewer signing workspace

Open `/governor` and connect a configured reviewer wallet on Devnet. Generate a fresh action with `governor:verify`; the workspace accepts version 3 artifacts bound to the network genesis, deployed program, multisig and vault. Paste the action JSON and independently inspect its report and source evidence. A report hash does not authenticate an agent decision.

Creating a proposal requires verification within the five-minute creation window and sufficient execution time for the two-day delay. Record its proposal index and preserve the exact action JSON. Each reviewer independently compares and approves that index. Approval and execution fetch the actual Squads transaction and reject any difference in accounts, privileges or instruction bytes. After quorum and the onchain delay, use the same action and index to execute before its seven-day execution expiry. Creation does not count as approval. Never regenerate an expired action and assume it matches an existing proposal; create and review a new proposal instead.

This interface has automated validation and browser checks. It has not yet completed the real reviewer pilot and does not establish independent audit approval.

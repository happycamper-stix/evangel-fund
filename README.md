# Evangel — governed OSS funding on Solana

Website: [evangel.fund](https://evangel.fund). Canonical domain for the landing page, launchpad, funding and docs.

Social token launches and OSS payroll, without a platform token.

- Launch specification: 21M fixed supply, 70% liquidity, 30% governed rewards. Verified adoption releases 1% upfront; developer total ≤20%, community ≥10%, shared releases ≤1% per rolling 21 days.
- Fee: **5% each buy/sell**, allocated **1% venue protocol / 2.55% development / 0.5% community / 0.8% governance / 0.15% foundation**, denominated in e/acc. Fees book to their UTC collection day. Daily unused governance goes to the originating project. No buy-and-burn.
- Repository funding needs no coin. SOL sponsorship has a 24-hour refund period. Contributors and explicitly declared repo owners earn payroll through plan review, delivery review and challenge windows. Failed work reopens for community contributors.
- Agent has no keys. Deployable custody requires an autonomous Squads v4 2-of-3 vault, minimum two-day timelock, and expiring actions. The founder cannot approve alone.

## Status

Custody is deployed on Devnet with verified 2-of-3 Squads governance and a two-day delay. See [public addresses and binary hash](docs/DEVNET_ADDRESSES.json). Production identity and the real participant pilot remain incomplete. No mainnet deployment or independent audit is claimed.

**Public launches are disabled.** Quote trading is tested in the isolated curve fixture; the production venue adapter remains unimplemented. The live e/acc metadata extensions match the pinned DAMM v2 source policy, but deployed venue binary and CPI verification remain open. The fixture still uses historical fees, not the target allocation above. Local tests are not a deployment. See [current economics](docs/CURRENT_ECONOMICS.md) and [production gates](docs/PRODUCTION_GATES.md).

Foundation fee recipient and one intended governance member: `92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc`. Governance/upgrade authority is the derived Squads **vault**, never this individual wallet.

## Develop and verify

Requires Node 24, Rust and the Solana SBF toolchain. `CARGO_BUILD_SBF` may point to the builder; the ignored local `.evangel/toolchain/solana-release/bin` is recognized.

```sh
npm ci
npm test
npm run build
npm run test:browser
npm run security:dependencies
npm run security:rust
npm run solana:compatibility
```

Tests download the hash-pinned immutable mainnet Squads binary read-only and execute it locally in LiteSVM. Public Squads configuration is a labeled test fixture. No real funds or mainnet writes are involved. `npm run solana:build` produces custody; `npm run solana:build:fixtures` writes the separate test artifact under `.evangel/test-programs`.

## Development deployment (Devnet by default)

```sh
npm run solana:governance -- REVIEWER_ONE REVIEWER_TWO
# Add --broadcast only after checking the public addresses and test funding.
# Set EVANGEL_GOVERNANCE_MULTISIG to the resulting public multisig account.
npm run solana:fixture -- deploy
npm run solana:deploy
npm run solana:deploy -- --broadcast
npm run security:monitor
```

The deployment preflight verifies the build manifest, quorum and timelock. Deployment transfers program upgrade authority to the verified Squads vault. Verify both authority records and the finalized manifest before setting `EVANGEL_SOLANA_PROGRAM` in Vercel. The official Squads Devnet deployment is itself upgradeable; do not describe it as immutable.

Test payer: `HJQv3jt9yMhxhKkUyzN1Csj3w3FxJ2ASfU9q8C26RDpb`. Its disposable seed is in macOS Keychain. Never place signing keys in source, Vercel, browser code, agent inputs or chat. Public addresses may be environment variables; private keys may not.

See [architecture](docs/SOLANA_NATIVE.md), [current internal security review](public/internal-security-review.md), and [public docs source](lib/docs/content.json).

## Public source

Public repository: https://github.com/happycamper-stix/evangel-fund. This is a source snapshot; older private Git history is not included. Environment secrets, local wallet/Keychain data, evaluation artifacts, build output and installed dependencies are excluded. `.env.example` contains configuration names and public defaults only.

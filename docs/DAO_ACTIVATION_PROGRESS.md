# Update: e/acc compatibility resolved

The new v3 guard supports the live e/acc mint's immutable self-contained metadata and Token-2022 ImmutableOwner accounts. Live raw-account inspection passes; 21 DAO tests include compiled-program transfers, malformed and malicious extensions, and truncated metadata. Five Rust rule tests and Clippy pass. No factory upgrade authority has moved. The separate mutable guard is deployed at `9Ys55BCVdd7SpYzSSmEoZuthit3xN664EooH34mxBFTz` on Devnet; finalized bytes match the reviewed build. See DAO_DEVNET_CANDIDATE.json. Live read-only simulation also confirms production-mode rejection of fast initialization (DAO_DEVNET_SIMULATION.json). Existing factory authority is verified unchanged.

The entries below record the preceding pass; its extension incompatibility is now resolved. Reviewer identities, governance activation, holder UI and real participant rehearsal remain separate.

---

# DAO activation progress — 2026-10-03

## Completed this pass

- Added a raw-account mint compatibility inspector matching the current Rust guard predicate, with negative tests for extensions, token program, executable accounts, authority, precision, initialization and supply.
- Inspected the real e/acc mint on mainnet at finalized slot 452867104. Its account is 389 bytes; the current guard requires 82 bytes. It is **not compatible with this DAO candidate**. See DAO_MINT_INSPECTION.json. Pairing compatibility is a separate policy and does not imply voting compatibility.
- Added restricted holder transaction builders for deposit, withdraw, challenge and vote. Custody addresses are derived, not caller-provided. Compiled-program tests now exercise the deposit/challenge/vote builders. These builders are not a live holder UI.
- Added a read-only live release inspector: checks development-cluster genesis, finalized program/data/config/mint accounts, pinned executable bytes, guard immutability, reviewed identities, fixed denominator, public mode and actual target upgrade authority. All accounts are observed in one RPC batch. It refuses mainnet and performs no transactions.

## Verification

17 DAO tests (including compiled-program scenarios), five native Rust tests, 72 regression tests, 50 browser checks and Next production build passed. These are local tests, not a real Devnet participant rehearsal. No authority was transferred and no deployment was performed in this pass.

## Required inputs and remaining work

1. User choice of governing mint, three reviewer public keys, proposer and treasury confirmation. No test identities may substitute for these.
2. If e/acc is chosen, implement and review narrowly scoped metadata-extension support in the onchain guard and token-account handling, with adversarial tests. Do not silently loosen the 82-byte predicate. If a future Evangel token is chosen, it must actually exist and satisfy the mint rules.
3. Publish distribution/participation analysis. Deposits must mature seven days **before proposal creation**. An empty electorate cannot provide meaningful public challenge protection.
4. Complete and test the holder UI against a pinned, verified deployment. The existing UI remains inactive.
5. Deploy a disposable guard/target/mint rehearsal on Devnet; exercise real participant signatures and elapsed time, including failure and recovery. Do not replace real-time evidence with local clock warps.
6. Review final artifact and exact authority migration, then obtain the existing Squads signatures and obey its 48-hour delay. Mainnet activation remains separate.

## Repeatable read-only checks

```sh
npm run dao:inspect-mint -- mainnet-beta CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU
npm run dao:inspect-release -- /absolute/path/to/reviewed-release.json
```

The first exits 2 for an incompatible mint. The release file requires `cluster` (devnet or testnet), guard `program`, `production` binary length/hash with `developmentOnly: false`, fixed `supply` as a decimal string, and `expected` containing target, mint, developer, treasury and three reviewer addresses in onchain order. Populate it only after identity confirmation and review; the candidate manifest with null identities is deliberately insufficient. A successful check proves the observed account configuration, not independent review quality, participation or exploit immunity.

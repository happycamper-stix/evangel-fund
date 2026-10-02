# Governed custody and fee revision

> Historical implementation specification: the fee rate, buy-and-burn requirement and quote-asset assumptions below are superseded by [current economics decisions](CURRENT_ECONOMICS.md). Do not use these older requirements to activate production trading. The implementation transition is pending.

Approved scope: preserve 21M supply and governed 30% reserve, remove unrestricted agent/founder custody, evaluate established launch infrastructure before enabling it, and replace negotiated buy/burn payments with constrained venue execution. Current work starts from bd0071a.

## Fee specification

Percentages are of gross trade value: 2% buy-and-burn existing e/acc; 2.7% governance inference/API costs; 5% OSS contributors and repository-owner payroll; 0.3% foundation to 92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc. Total 10%. Within the fee pool these weights are 20/27/50/3. Integer dust is held until distributable; no unallocated dust is assigned to an administrator. Fees on unrelated pools cannot be enforced by Evangel.

## Implementation boundaries

- Fixed foundation recipient; governance expenses require evidence, quorum and notice. No expense may spend the burn or OSS budgets.
- SOL owner payroll uses published milestone terms, independent completion review, challenge delay and fixed-recipient claims. It does not consume the token supply cap. Failed payroll work reopens for community contributors.
- Immutable token authorities and hard token caps remain. Governance may not redirect awards or alter limits.
- Squads v4 2-of-3 vault authority, independent member addresses, no single config authority, at least two-day timelock. Reject unsafe multisig configuration at initialization and governed execution. Upgrade authority should use the same vault during pilot, then be revoked after independent audit.
- Agent evaluates evidence and prepares unsigned actions. It has no keys and cannot execute directly. Independent signers review the exact instruction and supporting report.
- No arbitrary OTC seller settlement. A supported venue adapter must validate all accounts, exact e/acc mint, independently justified fresh pricing, minimum output, liquidity and spending caps, and atomic buy/burn. Without a verified adapter/reference, burn execution fails closed and funds accumulate.
- Custom curve remains isolated test infrastructure until a compatible established launch integration passes exact economics/custody checks. No automatic production fallback to custom trading.
- No mainnet deployment, external audit or public bug bounty is claimed. Production gate requires independent review, capped pilot configuration, verified deployment and dependencies, real reviewer addresses, and monitoring.

## Compatibility evidence

Meteora DBC source f552f20aa3c1c7631427c3827aeea7c58b902813 mints initial supply into its base vault; leftover withdrawal requires CreatedPool migration progress, and creator vesting requires PostBondingCurve. Its protocol fee is 20% of collected trading fees. These conflict with pre-graduation access to Evangel's 30% reserve and an exact 10% total that fully reaches the four destinations. Changing these requirements requires an explicit user choice; do not quietly enable the integration.

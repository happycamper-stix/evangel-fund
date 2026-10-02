# e/acc pairing and daily funding verification

Date: 2026-10-01. Review baseline: b763265aed153ab69b695bc6b1fcf141850659c3. Scope: local implementation, client flows and documentation; not an independent audit or public factory deployment.

## Delivered behavior

- Every isolated launch uses the configured immutable dummy e/acc quote token. The mainnet e/acc mint stays pinned in public configuration; it is never replaced or burned.
- Buys and sells charge 5% of gross quote value. The fee pool allocates 60% development, 10% community, 27% governance, 3% foundation (3%/0.5%/1.35%/0.15% of trade value).
- Development fees pay the verified project owner without work approval. Before adoption, income stays reserved.
- Project-specific UTC-day token vaults protect contributor allocations and approved unpaid expenses. Permissionless closure moves only unused governance and rounding dust to development. The runner atomically closes and pays eligible development income; late runs remain possible.
- Quote-funded community milestones use the existing evidence, review, challenge and reopening rules. SOL sponsorships remain separate. Founder project-token vesting was not changed.
- Legacy global SOL fee and buy/burn instructions reject execution. Factory tag 10 prevents reinterpreting earlier deployment state.

## Validation results

- 39 unit/integration tests passed, including compiled SBF, real Token-2022 transfers, real associated token accounts and the hash-pinned deployed Squads binary.
- 44 browser checks passed across desktop and mobile. Wallet Standard tests execute real SBF launch, quote buy, daily close and development payout, and verify the quote-community beneficiary restriction.
- Production Next.js build passed.
- npm audit: zero reported vulnerabilities.
- Cargo audit: no reported vulnerabilities; one existing unmaintained dependency warning, bincode 1.3.3 through the Solana dependency tree.
- git diff whitespace validation passed.

Tests cover no mint/freeze powers, fixed supply, backed quote reserves, price invariant, slippage, exact fees, rounding, fixed recipients, missing adoption, invoice replay, wrong day/project/vault, expense caps, canceled liabilities, late/repeated closure, unpaid commitments surviving closure, contributor work payouts and real delayed quorum reimbursement.

## Standards / security review

A review identified rejection of standard Token-2022 associated recipient accounts by an overly strict 165-byte length check. A failing real-ATA regression reproduced it. The fix retains token program, mint, owner, state and owned-vault checks while letting Token-2022 validate recipient extensions. Regression passes. Follow-up found no remaining material issue in reviewed custody paths.

## Spec review

A review identified an owner-payroll option that could silently become a community-only quote milestone. The form now resets/disables that choice and rejects it before signing; the browser regression verifies it. Follow-up found no remaining findings in UI and daily settlement wiring.

## Remaining release gates

- No production trading adapter is enabled. Meteora DBC's pre-graduation reserve access and protocol fee share still conflict with the exact requirements. Mainnet e/acc Token-2022 extensions also require venue and custody verification; the current test binary intentionally supports an extension-free dummy quote mint only.
- The daily runner is implemented, but no funded production/testnet scheduler has been activated against a deployed trading program.
- Testnet preflight: payer HJQv3jt9yMhxhKkUyzN1Csj3w3FxJ2ASfU9q8C26RDpb has 0 lamports. Conservative program funding target is 3.463661040 test SOL, excluding separate multisig setup costs. Governance multisig is not configured; two independent reviewer public addresses are still needed.
- Quorum reimbursement deliberately uses a future execution day's fees for already incurred invoices. Operators front bills; insufficient fees or a missed booking day cannot encumber old days after surplus is returned.
- External audit, funded pilot and production authorization remain necessary. No claim of exploit-proof contracts is made.

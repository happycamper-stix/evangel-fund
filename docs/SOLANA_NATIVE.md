# Solana custody architecture

## Custody and trading are separate

The default SBF build contains the governed funding state machine and rejects native launch/swap opcodes. The `test-fixtures` build exercises the original curve, 21M supply, 70/30 allocation and token release rules locally. It is never accepted by the deployment script. No compatible public trading adapter is enabled; Meteora DBC's pre-graduation custody and protocol-fee limitations are recorded in IMPLEMENTATION_V2.md.

## Funding

Tokenless repositories register a GitHub source, obtain evidence-reviewed adoption and receive SOL sponsorships. A sponsor can refund within 24 hours; settled money funds milestones. Both community contributors and explicitly declared repo owners can earn SOL payroll. Approval of scope commits budget; a separate completion approval, evidence binding and two-day challenge window precede the fixed-recipient claim. Failed owner work becomes community work without changing criteria or losing its budget. Token reward accounting is separate from SOL payroll.

Test-pilot funding is capped at 10 SOL per repository over its lifetime, less refunded sponsorship. Paid milestones do not reset that headroom. A single SOL reward is at most 1 SOL.

## Fees

All project pairs use e/acc; isolated tests use a distinct immutable dummy quote mint. Trades charge 5% each direction in quote tokens: 3% development, 0.5% community, 1.35% governance and 0.15% foundation. FeeDay accounts and token vaults isolate every project's daily budget. Developer income is permissionlessly payable only to the adopted owner. Community quote rewards use the existing plan/delivery/challenge state machine with a bound fee day.

Daily closure moves uncommitted governance funds and integer allocation dust to development, preserving outstanding community and invoice commitments. The keeper closes overdue days and pays the owner atomically. Its scheduling host pays rent/network fees; program execution is never automatic. See CURRENT_ECONOMICS.md for exact reimbursement timing and settlement operations.

The old buy/burn and global SOL fee opcodes permanently reject execution. Factory tag 10 is incompatible with previous deployments; no in-place funded migration is implied. Invoice approvals use a future execution/booking day after Squads delay, actual incurred-cost evidence, a 100 dummy-token/day pilot cap, and a further two-day payout notice. SOL sponsorships remain separate.

## Governance and keys

Squads v4 vault 0 is the authority. The program checks the canonical multisig owner, discriminator, derived account and vault addresses, autonomous config authority, exact 2-of-3 membership including the foundation, unique full-permission members and minimum two-day delay. It repeats the checks on governed execution. Addresses cannot prove that reviewers are independent humans.

Governed instructions have a seven-day maximum execution horizon. The agent produces a v2 action bound to program, authority, multisig, exact request and evidence. Proposing requires a fresh five-minute verification artifact. Approval/execution compare the actual onchain Squads transaction with the reviewed instruction. Squads enforces quorum and delay; Evangel enforces revision, recipient, cap and expiry. A proposal approval does not remove the milestone's subsequent challenge period.

Private keys stay outside inference and the website. Independent members sign through their own wallets. The deployment payer uses macOS Keychain and a short-lived ignored mode-0600 CLI file. Program keypairs, build artifacts and journals are ignored. After an interrupted deployment, inspect chain state before retrying.

## Upgrade and dependency risk

Pilot program upgrade authority is transferred to the Squads vault. It remains powerful until irreversibly revoked after audit and stabilization. The official Squads testnet program has an operator upgrade authority; mainnet Squads is immutable. Local integration tests use a hash-pinned immutable binary, not a claim that testnet shares its authority state.

There is no independent audit yet. Production-mode initialization is rejected and deployment tooling is testnet-only; a Solana program does not independently identify its cluster. Production requires compatible trading, constrained settlement, external review, monitoring and the gates in PRODUCTION_GATES.md. All other quote assets, including tokenized stocks, are outside the current plan.

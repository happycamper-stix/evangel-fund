# Production gates and pilot operations

No mainnet trading or e/acc settlement is enabled. This is an implementation checklist, not a completed audit.

## Before any public pilot

1. Two independent reviewer public addresses, plus the fixed foundation member. Set up autonomous Squads v4 2-of-3, minimum 172800-second timelock, no unilateral config authority. Devnet's official Squads program remains upgradeable by its own operator; the immutable mainnet binary used in local integration tests does not remove that Devnet dependency.
2. Build custody without `test-fixtures`. Deploy script verifies the build digest and rejects fixture manifests. Initialization rejects a single-wallet authority. Verify factory authority and upgrade authority equal the Squads vault, not the multisig account or founder wallet.
3. Fund only with test SOL. Pilot limits: 10 SOL lifetime funding per repository (refunded sponsorship releases headroom), 1 SOL maximum per payroll milestone, inference/API quote reimbursements ≤100 dummy tokens per project UTC booking day. New rules or increased limits require a separately reviewed version.
4. Test registration, adoption, refundable sponsorship, plan and delivery review, challenges, failed-work reopening and fixed-recipient claims through actual wallets. Verify finalized receipts, not just model reports or local VM tests.
5. Run `npm run security:monitor`. Inspect alerts for custody shortfalls, changed governance membership/threshold/delay, unexpected upgrade authority, missing accounts or invalid token authorities. Monitoring is read-only; schedule it only when explicitly requested.

## Before mainnet

- A compatible established trading venue must prove immediate 1% adoption access, protected 30% reserve, fixed 21M supply, revoked mint/freeze authority, exact fees and migration economics. Current Meteora DBC does not meet these requirements unchanged.
- Verify the exact existing e/acc quote mint, its Token-2022 extensions, canonical venue/vault bindings, migration behavior and gross 5% fee accounting. No buy-and-burn or arbitrary quote asset is supported. The current test binary accepts only extension-free dummy quote mints.
- Publish a first-party internal security review of custody, adapters, client transaction construction, governance and deployment, as chosen by the founder on October 2. Label it clearly; external certification is not claimed. Record scope, commit and binary hashes, findings and remediation. Resolve critical/high issues, dependency warnings, and testnet discrepancies.
- Publish addresses, role powers, fee accounting, reviewed source/build provenance, known limitations, a private vulnerability reporting route and a funded bug bounty with explicit scope. Do not advertise an unfunded bounty or invent an auditor's approval.
- Small capped mainnet pilot only after explicit authorization. Review monitoring and incident response with independent signers.
- After stabilization, propose irreversible upgrade-authority revocation through Squads. Verify the program's loader data has no authority. Existing vaults keep immutable rules; new versions serve future opt-in projects. Upstream protocol upgrade powers must also be assessed and disclosed.

## Limits of these safeguards

Quorum protects against one compromised key, not colluding signers. Human independence, useful work and the truth of cost invoices cannot be established by wallet addresses or hashes alone. Freeze/mint revocation does not make an upgradeable custody program immutable. No local test or clean dependency scan proves that a program cannot be exploited.

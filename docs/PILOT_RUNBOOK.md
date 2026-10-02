# Real participant Devnet pilot

Status: happycamper-stix/evangel-fund is now public and registered on Devnet. See PILOT_REGISTRATION.json. Ownership adoption, production Clerk setup and real reviewer signatures remain pending. The private repository history was not published.

## Participants and setup

One verified adopting maintainer, one independent contributor, a sponsor, and the configured independent reviewers. Start with one repository; expand to 3–5 after the first full cycle. Use only disposable Devnet funds. Each participant signs their own wallet transactions. No operator should request private keys. Identity uses GitHub plus a Solana signature; maintainers must retain appropriate repository access when the action is verified.

## Acceptance sequence

1. At `/verify`, sign in, link GitHub and the intended Solana wallet. Verify repository role. Check wrong wallet, signed-out access and revoked repository permission fail. Save redacted result, time, repo, wallet and reviewer observations; never save OAuth tokens.
2. Register the public repo at `/fund`. Submit adoption terms. Governor evaluates evidence and independently verifies identity, then produces a version 3 action. Reviewers inspect evidence and create/approve at `/governor`. Record proposal index, exact action/report hashes and finalized signatures.
3. Wait for the actual two-day quorum timelock, execute, then respect the additional adoption notice before finalizing. Onchain time cannot be fast-forwarded on Devnet. Tokenless fund adoption pays no upfront SOL.
4. Sponsor a small amount. Exercise refund within 24 hours, then make another sponsorship and settle after 24 hours. Confirm balances and liabilities before creating a payroll commitment. Stay below the 10 SOL lifetime repository cap.
5. Maintainer proposes measurable work/criteria, declared owner work or contributor work, budget and deadline. Agent finalizes; reviewers approve. Planning is not delivery approval. Stay within the 1 SOL payroll milestone cap.
6. Contributor submits immutable evidence. Review, approve, wait required notices, and claim to the fixed recipient. Test challenge and resolution, including prevention of payout while disputed.
7. Use a separate deliberately unsuccessful milestone to exercise rejection and reopening to another eligible worker, preserving its allocation and acceptance criteria. Confirm no duplicate compensation.
8. Check monitor output, finalized explorer receipts, user-visible statuses and retry behavior. Document usability problems. Token launches, e/acc trading, quote-fee settlement and upfront token grants remain separate acceptance tests until the adapter is deployed.

## Receipt record

For each step record: cluster, source commit/build hash, repository, project/milestone addresses, initiating public wallet, action/report hash, proposal index, submitted signature, finalized slot, expected/actual balances, notice/expiry timestamps and pass/fail with reason. An unsigned intent, simulation, UI success message or transaction submission alone is not a finalized receipt.

## Incident drill

Introduce an altered baseline locally and confirm monitoring fails. Do not mutate live governance to test an alarm. On an unexpected code hash, authority, membership or balance change: stop new deposits and signing, preserve read-only evidence, notify the actual reviewers, independently check RPC and chain state. Do not claim the protocol is paused unless an implemented pause actually takes effect. Any upgrade requires the normal quorum and delay; never bypass that response path. Resume only after the cause and affected balances are reconciled.

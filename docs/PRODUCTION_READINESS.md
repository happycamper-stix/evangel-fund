# Production readiness — October 2, 2026

**Current release: public Devnet funding pilot. Mainnet trading is not ready or enabled.**

## Implemented and checked

- Production GitHub login and wallet binding; actual owner verification, wrong-wallet rejection, and unrelated-repository role rejection.
- Fixed 21M supply, atomic 70% venue liquidity and 30% reserve, immutable project mint authorities, permanent venue position custody, and separately sponsored one-unit quote initialization in the local adapter.
- Positive buy/sell tests against observed mainnet and Devnet venue executables; 5% fee, 20% protocol share, approved net receipt allocation, collection-day accounting, unpaid expense preservation, and daily surplus.
- Canonical account checks, upstream deployment pins, immutable metadata allowlist, no-double-credit checks, wrong-account/configuration/delegate rejection and atomic launch rollback.
- Exact observed mainnet venue/source equivalence through a digest-pinned Linux build (DAMM_VERIFIED_BUILD.json).
- Separate review build requiring actual Squads governance. Neither local test-authority bypasses nor legacy trading are enabled in that build.
- Keeper construction and per-signature journaling; deployment hash/baseline gate before signing. Public launch and sponsorship services remain disabled pending deployed acceptance.
- Live aggregate API threshold enforcement, scheduled private-repository custody/website checks, and published first-party security review. No independent audit is claimed.

Evidence: `VENUE_ADAPTER_CANDIDATE.json`, `LIVE_RATE_LIMIT_CHECK.json`, `DAMM_ADAPTER_SPEC.md`, and `/internal-security-review.md`. 65 unit/integration tests, 12 venue tests, 48 browser checks; dependency scans report no vulnerability advisory, with the disclosed bincode maintenance warning.

## Remaining gates, in order

1. **Fresh provenance check:** the digest-pinned Linux build now matches the observed mainnet venue. Recheck it immediately before launch; the venue remains upgradeable, so a new deployment invalidates prior evidence.
2. **Reviewed deployment:** independently inspect the adapter review artifact and adoption hardening, upload a reviewed upgrade buffer, and obtain actual 2-of-3 Squads approval plus the real two-day delay. Verify finalized deployed bytes before updating the baseline. No upgrade has been submitted or signed in this work.
3. **Real participants:** owner signs the prepared tokenless adoption terms; reviewers evaluate and approve. Complete real sponsorship/refund, payroll, challenge and failed-work reopening, including actual notice periods. See PILOT_RUNBOOK.md. Local VM clock advancement cannot replace these receipts.
4. **Public venue acceptance:** launch a dummy-quote project on Devnet, execute buys/sells, collect on two different days and settle to actual fixed recipients. Bind the public launch/trade UI and sponsored-dust signer service to that accepted deployment; do not reuse the legacy virtual-curve UI or expose a signing secret to browsers.
5. **Operations:** exercise collection/settlement retries and bounded signer funding, actual revoked-repository access, alert delivery and recovery. Monitoring is scheduled; fee collection is not yet a running service. No notifications to outside reviewers were sent.
6. **Capped mainnet:** separately authorize mainnet configuration, funding and deployment after those receipts pass. Recheck e/acc mint extensions and current venue code immediately before release, then run a limited launch before wider marketing.

## Immediate owner action

Use the public repository and wallet already verified at `https://evangel.fund/verify`. At `/fund`, select the registered Evangel repository and submit the exact `PILOT_ADOPTION_TERMS.json` text through Phantom on Devnet. The signing wallet must be `92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc`. An account login is not an onchain adoption signature. The configured independent reviewers must sign their own approvals; the operator cannot substitute for them.

# Historical security comparison

Economic descriptions below record earlier versions. Current behavior and new review findings are in CURRENT_ECONOMICS.md; the old SOL fee split is retired.

# Factory security review — 30 September 2026

## Scope and reference comparison

This is an implementation review and adversarial test pass, not an independent audit or a guarantee against exploitation.

Reviewed primary source:

- [Meteora Dynamic Bonding Curve](https://github.com/MeteoraAg/dynamic-bonding-curve/tree/f552f20aa3c1c7631427c3827aeea7c58b902813): Token-2022 initialization and mint-authority finalization. Its authority configuration supports options Evangel intentionally omits. Evangel always removes mint authority and never sets freeze authority; it does not enable transfer hooks, permanent delegates or configurable token fees.
- [Raydium CPMM swap implementation](https://github.com/raydium-io/raydium-cp-swap/blob/59fb845a9e5bb569c8b2f3415f13b0c0ebcc6b92/programs/cp-swap/src/instructions/swap_base_input.rs): account/vault bindings, checked arithmetic, minimum received amount and constant-product checks. Evangel now explicitly verifies the product does not decrease, validates exact vault addresses and token programs, and checks actual SOL coverage. This comparison used accessible CPMM source; it is not a claim that inaccessible LaunchLab source was reviewed.
- [Solana authority documentation](https://solana.com/docs/tokens/basics/set-authority): revoked mint authority and absent freeze authority are distinct from program upgrade authority.

A mature program's audit does not transfer to this independently written factory. No claim of integration with Raydium or Meteora is made.

## Changes and adversarial checks

| Area                         | Control / result                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supply                       | Launch mints 21M once; mint authority becomes None atomically.                                                                                                          |
| Freeze                       | Freeze authority starts as None. Owner and outsider freeze attempts fail in actual Token-2022 execution.                                                                |
| Authority restoration        | Owner and outsider attempts to reassign mint authority fail.                                                                                                            |
| Wrong accounts               | Program ownership, exact PDAs, mint and token-account owner bindings; incorrect reserve substituted for pool fails.                                                     |
| Prefunding denial of service | Fixed: pre-existing system-owned, empty PDAs are topped up, allocated and assigned safely. Sending rent to a future address cannot block launch.                        |
| Curve solvency               | No real SOL at launch; sells cannot use virtual balances; product invariant checked after every swap. Repeated-trade tests reconcile program balances and token vaults. |
| Segregated funds             | Trading reserves, refundable sponsorship, available/committed OSS and factory fee budgets are separately accounted.                                                     |
| Fee routing                  | 20/27/50/3 cumulative split; OSS fee allocation can only credit an adopted project, not a wallet.                                                                       |
| Settlement                   | Retired OTC opcode always rejects. Burn funds accumulate until a verified venue and independent price reference are implemented.                                        |
| Rewards                      | Upfront counts in developer cap/window; plan approval alone cannot pay; developer cannot consume community minimum; queued worker awards have priority.                 |
| Failed work                  | Budget retained, community-only reopening, new revision, stale submissions rejected.                                                                                    |
| Disputes                     | Challenge blocks payment; a resolved review stage cannot be challenged repeatedly.                                                                                      |
| Refunds                      | Sponsor-only during 24 hours; settlement/reimbursement is single-use.                                                                                                   |
| Browser                      | Wallet Standard signing tested against compiled SBF in isolated LiteSVM, plus desktop/mobile accessibility checks.                                                      |

## Quorum and custody revision

The default program now rejects custom-curve launch/swap. They exist only in a separately compiled local fixture. Default initialization requires a verified Squads v4 vault; every governed execution rechecks its 2-of-3 autonomous quorum, member uniqueness and two-day timelock. Governed actions expire within seven days. The browser compares the onchain proposal to the reviewed instruction before approval or execution.

Integration tests use the immutable mainnet Squads binary SHA-256 `dec8d3e0fae58c7c8f2416e5f67c25e673f047afd6dd2bba4a47e0b29a01d34c`, with public protocol configuration copied into LiteSVM. Tests create the actual multisig and execute real votes/CPI; no forged vault signature substitutes for consensus. Deployment loader metadata is modeled only to initialize the local Evangel instance. The official testnet Squads program is still upgradeable by its operator.

SOL owner payroll follows the same plan/delivery/challenge flow as contributor work. Failed payroll becomes community work. Foundation fees have a hardcoded recipient. Governance expense approvals bind an invoice, reserve only the governance budget, wait two days and pay the quorum vault, at most 0.1 SOL per rolling day. Pilot repository funding is capped at 10 SOL lifetime and payroll milestones at 1 SOL.

## Remaining trust and production gates

- Upgrade authority can replace custody logic until it is irrevocably removed. Independent quorum reduces single-key risk; colluding reviewers remain a risk.
- A program cannot prove useful work, honest invoices, independent human identities or fair market prices. Evidence hashes are bindings, not proof of truth.
- Meteora DBC has not passed compatibility: its reserve access depends on graduation and protocol fees consume 20% of the pool fee. Public launches remain disabled.
- No verified e/acc venue and independent price reference are configured. The OTC settlement was removed; there is no automatic fallback purchase.
- No independent audit or public deployment receipt is claimed. See PRODUCTION_GATES.md for external review, capped pilot, monitoring, bounty funding and eventual immutability.
- Bounded worker queues may delay payouts until disputed prior awards are resolved.

## Dependencies

The Solana SDK was updated to 5.1.0. The prior rand soundness and libsecp256k1 maintenance warnings are no longer in the dependency graph. `bincode 1.3.3` remains an upstream unmaintained dependency: [RUSTSEC-2025-0141](https://rustsec.org/advisories/RUSTSEC-2025-0141). This must be tracked; a scan does not establish safety.

The official Squads JavaScript SDK was evaluated but brought in vulnerable legacy dependencies. The implementation uses a small wire adapter for documented Squads v4 instructions, tested against its actual immutable program, without adding that dependency tree. Reference source: Squads-Protocol/v4 revision af94153ff77a28b6effe46b9c94baaa93742b48c.

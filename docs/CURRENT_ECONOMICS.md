# Current economic and governance rules

Updated 2026-10-03. This document supersedes older fee splits and upgrade-window proposals. Mainnet/public trading remains disabled. Local candidates and isolated fixtures are not public deployment evidence.

## Fees

**5% per buy and per sell**, including venue charges:

| Gross trade share | Recipient |
|---|---|
| 1% | Venue protocol |
| 2.55% | Adopted project owner's development budget |
| 0.5% | Community contributors |
| 0.8% | Governance inference/API expenses |
| 0.15% | Foundation |

The actual 4% net venue receipt is split 63.75 / 12.5 / 20 / 3.75. Never charge the venue share twice. `lib/solana/fee-policy.mjs` defines these targets. Old 3% development / 1.35% governance fixture allocations are historical test behavior, not production policy. The reviewed venue adapter is not activated.

Development fee income does not require a milestone. Community rewards and reserve allocations do. Fees book to the **UTC collection day**, not trade day. Unused governance and dust go to the same project's development budget at daily close; approved, incurred but unpaid commitments remain reserved. No speculative cost reservations, cross-project borrowing, or duplicate reimbursement.

Permissionless settlement and a keeper implementation exist. The last recorded keeper dry run stopped at the undeployed adapter; no always-on signing service is claimed. Expense approval and payout retain existing two-day notices; the six-hour upgrade change does not shorten expense safeguards.

## Tokens and funding

- Solana only. Every project coin: 21M tokens, six decimals; 70% initial token-side liquidity/inventory, 30% governed reserve.
- Verified adoption releases 1% upfront, inside the developer's total 20% cap and shared rolling 1%/21-day release ceiling. Remaining 29% is milestone-earned. At least 10% is for community/workers.
- No mint/freeze authority after launch. Existing e/acc is the quote asset: `CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU`. No buy-and-burn or replacement e/acc mint. Test deployments use clearly identified dummy assets.
- No developer-supplied quote liquidity is the launch objective, but real buyer liquidity is still necessary. Virtual balances are not spendable. Venue and quote-mint compatibility remain release gates.
- Evangel's own public repository may participate under the same project rules; no Evangel token mint has been configured merely by permitting one.
- Tokenless repository funding is supported. Donors need a wallet, not GitHub verification. Ownership/contributor claims require identity evidence.
- Current SOL sponsorship funds milestones and has a 24-hour refund period. Owner payroll must be declared work. Direct unconditional donations to a personal wallet are not yet implemented.
- Pilot caps remain 10 SOL lifetime repository funding and 1 SOL per SOL milestone.

## Upgrade governance

[Candidate v2](DAO_GOVERNANCE.md) implements a **six-hour public challenge window**, 72-hour escalated vote, 1% challenge threshold, 30% turnout and strictly greater than two-thirds approval. It adds reviewed, time-bounded development mode in a separate development-only artifact, irreversible public activation, and holder-approved key recovery. The production artifact rejects fast mode.

This DAO is not activated. Existing Squads authority and its 48-hour delay remain. Existing milestone/adoption/reimbursement notice periods remain two days. Do not substitute one clock for another.

Before release: confirm mint/reviewers, inspect the exact final artifacts and authority migration, test with real participants, verify quote-mint extensions and venue accounting, complete operating-service/recovery gates, and obtain separate mainnet authorization.

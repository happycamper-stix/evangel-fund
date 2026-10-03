# Latest fee decision — 2026-10-02

The user approved 5% per buy and sell including the venue share: 1% protocol, 2.55% development, 0.5% community, 0.8% governance, 0.15% foundation. Evangel receives 4% net. Divide actual net receipts 63.75% / 12.5% / 20% / 3.75%; do not deduct the protocol share twice. Unused governance still returns to development at daily close, excluding committed expenses.

`lib/solana/fee-policy.mjs` defines and tests this target accounting. No production venue is enabled. The existing isolated curve and its custody accounting remain the previous version until a reviewed adapter implements the revised receipts; they must not be represented as the approved production economics.

## Prior implementation record (superseded fee split)

# Current economics decisions

Status: implemented in local custody/curve fixtures and clients; production trading remains gated. This document supersedes conflicting economic requirements in IMPLEMENTATION_V2.md. Default custody rejects trading. No live settlement or public deployment is claimed.

## Confirmed

- Solana only. Evangel’s public repository may participate as a project, including a project token under the same launch rules.
- Every launch uses existing e/acc as its quote asset: CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU. Do not create a replacement e/acc mint on mainnet. Tests must use explicitly identified dummy assets.
- Remove the e/acc buy-and-burn mechanism. Pairing does not burn tokens or guarantee net demand: buys put quote tokens into the pool and sells withdraw them.
- Latest confirmed trading fee is 5% on buys and 5% on sells, each assessed on that trade's value, rather than 10% per trade. Implementation uses 3% development, 0.5% community contributors, 1.35% governance and 0.15% foundation, preserving the 5% total. The former burn share is redirected to development.
- Unused governance funding returns to the development treasury of the project that generated it at the end of each day.

## Daily settlement design

Use UTC days and project-specific accounting. Settle a closed day once, permissionlessly, to a fixed project development treasury. Preserve only actual paid costs and independently evidenced incurred costs already committed against that booking day's budget; commitments cannot exceed its accrued governance fees. Do not permit speculative expenses or unrestricted future-cost reservations to suppress surplus. Canceled or excess commitments return to the same project. Never borrow from contributor or other project balances.

A keeper submits the daily transaction; the program validates the day, amounts, destination and replay protection. Solana programs cannot wake themselves up at midnight. A late keeper must leave settlement callable and must not change who receives the money. An invoice payment delay must not make the same funds both refundable surplus and payable expenses.

## Integration gates

- Verify an established venue supports the exact e/acc quote mint and its token-program/extensions, fee accounting, custody and reserve rules before enabling trading.
- A launch without developer-supplied quote liquidity requires a compatible bonding curve or equivalent mechanism that accumulates real e/acc from buyers. Conventional liquidity pools require real liquidity; virtual reserves are not spendable assets.
- Reconcile external venue charges with the advertised trade fee before release.
- Legacy global SOL fee instructions and buy/burn are rejected. Factory tag 10 requires a fresh deployment. No funded account migration is implemented.

## Still proposals, not approved changes

Automatic developer fee income and the 3%/0.5% development/community split are implemented. A founder allocation split between time vesting and milestone bonuses remains a proposal. The existing 21M supply and founder/community constraints are not implicitly changed by choosing a quote asset.

## Reimbursement timing

Quorum proposals wait at least two days. An already incurred invoice therefore targets a future booking day; execution can only reserve that day's available governance fees. Operators front costs, and neither a submitted invoice nor a future proposal encumbers current-day revenue. Missing the day requires a fresh proposal. Fees may be insufficient for reimbursement. Approval waits a further two-day payout notice; reserved unpaid amounts survive daily close. Cancellation frees funds without making the invoice reusable.

## Implementation and operations

FeeDay PDA seeds: fee-day, project address, signed little-endian UTC day. Fee vault seeds: fee-vault, FeeDay address. The account records cumulative fees, remaining development/community/governance/foundation budgets and outstanding commitments. Fee floors are calculated cumulatively per day; remaining dust goes to development at close.

Community quote rewards use the existing milestone state machine with quoteDay binding, independent work submission and fixed recipient. They never consume founder token caps or SOL sponsorships. Developer fee claims require adoption but no milestone.

`npm run solana:settle-days` previews overdue settlements using finalized chain time. `--broadcast` sends closure and development payout atomically, creating the fixed recipient's token account if needed. A protected funded operator must schedule the runner after 00:00 UTC. It is not activated against an undeployed program. The web UI also exposes permissionless close/claim actions.

Mainnet e/acc is pinned in the asset config. This test-only binary requires a distinct immutable six-decimal dummy quote mint with no extensions. It intentionally cannot be represented as a mainnet e/acc adapter. Production mint extensions and the venue require an independently reviewed implementation before mainnet support.

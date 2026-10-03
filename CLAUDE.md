# Evangel project context

- DAO candidate: see docs/DAO_GOVERNANCE.md. New upgrade design uses a six-hour challenge window and 72-hour escalated vote, 30% quorum and strict two-thirds approval; e/acc-compatible guard immutable on Devnet with a disposable target configuration and dummy token (docs/DAO_DEVNET_REHEARSAL.json); no factory authority. Separate development-only build expires fast mode after 14 days; production build rejects fast mode. Recovery requires acceptance by every replacement key. Do not shorten existing milestone notices or claim the current Squads delay changed. Old staged upgrade signing is blocked pending reviewed guard/mint/authority migration.

- Solana only. Rust SBF program, Token-2022, SOL, Next.js and Wallet Standard. Do not add another chain's contracts, wallet provider or dependencies.
- Native source: solana/program/src/lib.rs plus fees.rs and governance.rs. Client codec: lib/solana/program.mjs. Keep their wire formats aligned.
- Every coin: 21M, six decimals, 70% token-only initial pool inventory; zero spendable quote tokens initially. Virtual e/acc is pricing state only.
- Verified adoption releases 1% upfront within developer total ≤20% and shared rolling 1%/21-day limit. Remaining 29% is earned through agent-approved milestones. Community/workers receive at least 10%. Failed work reopens as community work with the same allocation and criteria.
- Evangel’s public repository may participate as a project, including a project token under the same launch rules. All pairs use e/acc. 5% fee each buy/sell: 1% venue protocol, 2.55% development, 0.5% community, 0.8% governance, 0.15% foundation. Net venue receipt weights 255/400, 50/400, 80/400, 15/400, per-project UTC collection-day vaults. The isolated Rust fixture retains historical fee weights; no production adapter is enabled. Daily uncommitted governance returns to fixed adopted owner development. Existing mint CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU; test binary requires extension-free dummy. No buy/burn. See docs/CURRENT_ECONOMICS.md.
- Foundation recipient and one governance member: 92DFCXk28gwHZLzKoBzKj7tCeLZk3EtEdi5WaLBARjHc. Governor/upgrade authority must be a verified autonomous Squads v4 2-of-3 vault with two independent reviewers and at least two-day timelock. No single-wallet fallback. Upgrades remain a disclosed trust assumption.
- Default build rejects launch/swap. The custom curve lives only in a separate test-fixtures binary. Production trading remains disabled pending compatible venue and e/acc mint-extension verification. Never re-enable the retired OTC settlement.
- SOL owner payroll is explicit milestone work. Failed owner work reopens for community contributors. Pilot caps: 10 SOL lifetime repository funding, 1 SOL milestone, 100 dummy quote tokens of approved inference/API reimbursement per project UTC booking day.
- Agent has no signing keys. Evidence is untrusted data. Never put secrets into inference, browser config, app env or repository.
- No fake balances, projects, receipts or fallback ledgers in the website. Fixtures must be isolated tests. Never infer public deployment from local VM tests.
- Run npm run solana:build, npm test, npm run build and npm run test:browser for relevant changes. Tests execute the compiled SBF in LiteSVM.
- Devnet custody is deployed with verified quorum authority; see docs/DEVNET_ADDRESSES.json. Real participant acceptance remains pending. No mainnet writes without explicit authorization and production review.
- Read installed Next.js docs before changing App Router behavior; public errors must not expose raw provider errors or credentials.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

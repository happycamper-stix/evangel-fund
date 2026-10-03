# Devnet adapter upgrade

This is gate 2 of the production-readiness checklist. Staging a buffer does not upgrade the running program. Public trading remains disabled.

## Preparation

Run `npm run solana:prepare-upgrade` from the repository root. It validates the reviewed artifact, current deployed binary, loader accounts, upgrade authority, and configured multisig. The report is written to `.evangel/solana-devnet/venue-upgrade-preparation.json`.

`npm run solana:prepare-upgrade -- --broadcast` uploads the exact reviewed artifact into a deterministic Devnet buffer, compares finalized buffer bytes, and transfers buffer authority to the existing Squads vault. It never creates proposals, approves them, executes an upgrade, or changes the deployed baseline. The paced uploader signs in memory using the macOS Keychain seed; it does not create private-key files. Signed write attempts are journaled before broadcast. Never copy keys into the repository or Vercel.

On interrupted uploads, rerun the same command to resume the same buffer. Do not generate another buffer or change the candidate hash to accommodate a mismatch. A buffer already controlled by the vault is checked without rewriting it.

## Member review and execution

Review the source, `VENUE_ADAPTER_CANDIDATE.json`, and the exact upgrade instruction in the preparation report. Account roles are 0 read-only, 1 writable, 2 read-only signer, and 3 writable signer. The report is an unsigned plan, not an onchain proposal. `lib/solana/squads.mjs` provides proposal, approval, transaction-content verification, and execution builders.

1. Open `https://evangel.fund/governor#upgrade` in a browser with your Solana wallet. The upgrade workspace checks the live buffer and deployed code before each signing action. Connect a configured member wallet on Devnet. Recheck the buffer hash and authority, current program bytes, governance members, and transaction index immediately before creating a proposal.
2. If capacity is insufficient, run `npm run solana:prepare-upgrade -- --broadcast --extend`. This adds zero-filled capacity using the test operator as rent payer and verifies that executable bytes and upgrade authority remain unchanged. The legacy extension must be a top-level instruction: the loader rejects it when invoked inside Squads. It cannot replace program code or change authority.
3. Use **Create upgrade proposal**, note its index, then **Compare and approve upgrade**. A second configured member enters the same index and approves from their own wallet. Two members approve it and wait the configured 172800-second timelock before execution. Recheck the finalized buffer, capacity, authority, and compiled transaction accounts before signing or executing.
4. After the delay, use **Execute approved upgrade**. Run `npm run solana:finalize-upgrade` to verify, then add `-- --write` to promote the baseline only when finalized code matches. Verify the finalized executable prefix against the candidate hash and length, confirm all remaining allocation bytes are zero, and confirm the upgrade authority is still the Squads vault. Only then update the deployment baseline and rerun the live monitor. The buffer rent returns to the original test operator specified in the instruction.

Do not replace an independent reviewer with the operator. Do not infer approval from login, a chat message, or a local VM signature. The operator is not a member and cannot create the required proposals. A local clock advance cannot satisfy a public-chain timelock.

## Following gates

After finalized upgrade verification, continue the real participant pilot, public Devnet venue acceptance, and operations drills in `PRODUCTION_READINESS.md`. Mainnet activation remains a separate decision.

## Validation

Local tests execute the loader capacity extension, reject an unauthorized upgrade, and execute the exact upgrade through the observed Squads binary only after two approvals and the configured timelock. Live unsigned simulation also accepted the top-level extension. Simulations and local approvals are not public-chain signatures.

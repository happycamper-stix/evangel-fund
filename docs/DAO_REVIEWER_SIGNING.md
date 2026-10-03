# Devnet participant wallet verification

Open https://evangel.fund/governor/rehearsal in a wallet-enabled browser.

1. Select your listed reviewer or developer address.
2. Connect that account using a Wallet Standard wallet with Solana message signing.
3. Read the exact message, then sign it. This is not a transaction and requires no SOL.
4. Download the proof JSON and send it to the deployment operator. The page verifies locally; it does not automatically register or upload the proof.

The operator verifies all four files with:

```sh
node scripts/solana/verify-reviewer-proofs.mjs /path/to/developer.json /path/to/reviewer-one.json /path/to/reviewer-two.json /path/to/reviewer-three.json
```

Exit 0 means all four distinct configured wallets have valid, unexpired signatures; exit 2 means participants are missing. Invalid, forged, expired or duplicate proofs fail. Proofs are bound to the current candidate bytecode, program ID, domain, network, and complete participant list. Changing those requires fresh signatures. Seven-day expiry limits reliance on stale possession evidence. These proofs are not authentication credentials, are not consumed as votes, and grant no onchain authority. Replaying the same proof cannot approve any action.

## Rehearsal sequence after verification

- Inspect finalized guard bytes and the remaining Devnet payer balance.
- Deploy a separate disposable target, create a dummy mint compatible with e/acc metadata, and verify mint/freeze revocation. Mainnet e/acc cannot be used on Devnet.
- Inspect the guard before making it immutable. Initialize the disposable target's guard configuration with the confirmed real participant keys and dummy mint. Transfer only the disposable target authority.
- Distribute dummy voting balances and deposit using actual participant wallets. Wait seven real days before proposal creation; the production guard has no time shortcut.
- Gather real code-review attestations, exercise the six-hour challenge window and the 72-hour contested vote, and verify final execution/rejection and withdrawals. Test recovery against a disposable configuration.
- Publish transaction evidence. Review factory migration separately through existing Squads approvals and its 48-hour delay.

The current factory authority is unchanged. No proof has been collected merely by entering a public address or publishing this page.

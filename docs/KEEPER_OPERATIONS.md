# Devnet keeper operations

The collector and settlement runner are implemented, but a funded, supervised scheduled service has not been activated. Public-chain collection and two-day settlement acceptance require the approved adapter deployment first.

## Release binding

After the actual upgrade finalizes, run `npm run solana:finalize-upgrade` to check it, then `npm run solana:finalize-upgrade -- --write` to promote the verified baseline. This refuses to promote a buffer or an undeployed artifact. Commit the new baseline and rerun the monitor before enabling any keeper.

Configure the existing Devnet program and governance addresses, and set both `EVANGEL_DEPLOYMENT_BASELINE` and `EVANGEL_VENUE_DEPLOYMENT_BASELINE` to `docs/DEVNET_ADDRESSES.json`. Do not point these variables at an unverified review candidate. Both signing scripts check finalized deployed bytes and governance; collection additionally requires the adapter flags in the promoted baseline.

## Funding and limits

Signing uses the dedicated `keeper` identity derived from the local development Keychain, not the deployment operator. Keep its balance between 0.02 and 0.25 Devnet SOL. Each signing step rechecks those limits. There is no automatic refill. A cycle refuses a workload over ten collection transactions or ten settlement transactions; partitioning and scaling are prerequisites for a larger rollout.

The Keychain signer is local development infrastructure. Do not copy it to Vercel, a GitHub secret, or a browser. An always-on signing service and its secret management remain an operational deployment requirement.

## Run and recovery

- `npm run solana:keeper-cycle`: read-only monitor, collection plan, then settlement plan.
- `npm run solana:keeper-cycle -- --broadcast`: performs those steps in order with signing enabled after their gates pass.
- `.evangel/solana-devnet/keeper-health.json`: latest result, including the failed step.
- `.evangel/solana-devnet/keeper-*.log`: local detailed step output.
- Transaction journals are written before broadcast. A failed step stops later steps. Check the journal signature and finalized account state before retrying after an ambiguous RPC result.
- A directory lock rejects overlapping cycles. After a crash, confirm the previous process has stopped and reconcile its signed attempts before removing the lock. Never remove a lock merely because another invocation wants to run.

Collection credits only actual newly received venue fees; settlement claims are enforced by onchain accounting. A retry can spend another network fee, but must not duplicate a project credit or payout. Public-chain retry and daily-boundary drills remain required after deployment.

## Evidence and limits

The pre-upgrade dry run passed monitoring, rejected collection against the old baseline, and skipped settlement. The overlap drill rejected a concurrent invocation. Unit tests reject depleted and overfunded signers. These demonstrate failure controls; they do not demonstrate a running scheduler, delivered external alerts, or a completed public-chain settlement cycle.

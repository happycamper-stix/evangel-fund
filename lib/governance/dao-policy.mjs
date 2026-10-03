// Candidate policy. Existing Squads custody is not changed by this module.
export const DAO_RULES = Object.freeze({
  challengeSeconds: 86400,
  votingSeconds: 259200,
  stakeMaturitySeconds: 604800,
  executionSeconds: 604800,
  challengeBps: 100,
  quorumBps: 1000,
  reviewerThreshold: 2,
  reviewerCount: 3,
  mint: null,
  deployed: false,
});
export const LEGACY_UPGRADE_HOLD =
  "Upgrade paused: the staged release predates holder challenge governance. A reviewed DAO guard, verified voting mint, and authority migration are required before signing a replacement upgrade.";

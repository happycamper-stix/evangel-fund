// Candidate policy. Existing Squads custody is not changed by this module.
export const DAO_RULES = Object.freeze({
  challengeSeconds: 21600,
  votingSeconds: 259200,
  stakeMaturitySeconds: 604800,
  executionSeconds: 604800,
  challengeBps: 100,
  quorumBps: 3000,
  approvalRule: "strictly more than two-thirds of votes cast",
  developmentMaxSeconds: 1209600,
  recoveryRequiresNewKeyAcceptance: true,
  reviewerThreshold: 2,
  reviewerCount: 3,
  mint: null,
  deployed: false,
});
export const LEGACY_UPGRADE_HOLD =
  "Upgrade paused: the staged release predates holder challenge governance. A reviewed DAO guard, verified voting mint, and authority migration are required before signing a replacement upgrade.";

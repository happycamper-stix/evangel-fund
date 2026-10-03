import { readFile } from "node:fs/promises";
import {
  reviewerContext,
  verifyReviewerProof,
} from "../../lib/governance/reviewer-proof.mjs";
const paths = process.argv.slice(2);
if (!paths.length)
  throw Error("Provide the downloaded participant proof JSON files.");
const context = reviewerContext(
  JSON.parse(await readFile("docs/DAO_RELEASE_CANDIDATE.json", "utf8")),
);
const results = [];
for (const path of paths) {
  const bytes = await readFile(path);
  if (bytes.length > 4000) throw Error("Proof exceeds size limit");
  const verified = await verifyReviewerProof(
    context,
    JSON.parse(bytes.toString("utf8")),
  );
  if (results.some((p) => p.wallet === verified.wallet))
    throw Error("Duplicate participant proof");
  results.push(verified);
}
const missing = [context.developer, ...context.reviewers].filter(
  (wallet) => !results.some((p) => p.wallet === wallet),
);
console.log(
  JSON.stringify(
    { results, missing, complete: missing.length === 0, onchainChanges: false },
    null,
    2,
  ),
);
if (missing.length) process.exitCode = 2;

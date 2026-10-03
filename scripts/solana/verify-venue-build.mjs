// Compare a freshly built executable with the pinned observed deployment, including padding.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { verifyProgramBytes } from "../../lib/solana/program-integrity.mjs";
const input = process.argv[2];
if (!input) throw Error("Provide the locally rebuilt venue executable path");
const observed = JSON.parse(
  await readFile("docs/DAMM_VENUE_INSPECTION.json", "utf8"),
);
const built = await readFile(input),
  deployed = await readFile(
    `.evangel/references/damm-v2-${observed.binarySha256}.so`,
  );
const hash = (b) => createHash("sha256").update(b).digest("hex");
if (hash(deployed) !== observed.binarySha256)
  throw Error("Observed executable cache changed");
const build = { binaryLength: built.length, binarySha256: hash(built) };
let verified = false;
try {
  verifyProgramBytes(deployed, build);
  verified = true;
} catch {}
const report = {
  sourceRevision: observed.sourceRevision,
  observedBinarySha256: observed.binarySha256,
  ...build,
  sourceBinaryEquivalenceVerified: verified,
  checkedAt: new Date().toISOString(),
};
await writeFile(
  "venue-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (!verified) process.exitCode = 1;

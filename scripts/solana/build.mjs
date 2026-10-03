import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
const modes = [
  "--test-fixtures",
  "--venue-candidate",
  "--venue-adapter",
].filter((x) => process.argv.includes(x));
if (modes.length > 1) throw Error("Choose exactly one build mode");
const local = ".evangel/toolchain/solana-release/bin/cargo-build-sbf";
const binary =
  process.env.CARGO_BUILD_SBF ||
  (existsSync(local) ? local : "cargo-build-sbf");
const result = spawnSync(
  binary,
  [
    "--manifest-path",
    "solana/program/Cargo.toml",
    "--jobs",
    "2",
    ...(process.argv.includes("--venue-adapter")
      ? [
          "--sbf-out-dir",
          ".evangel/venue-release",
          "--features",
          "venue-adapter",
        ]
      : []),
    ...(process.argv.includes("--venue-candidate")
      ? [
          "--sbf-out-dir",
          ".evangel/venue-programs",
          "--features",
          "venue-candidate",
        ]
      : []),
    ...(process.argv.includes("--test-fixtures")
      ? [
          "--sbf-out-dir",
          ".evangel/test-programs",
          "--features",
          "test-fixtures",
        ]
      : []),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${homedir()}/.cargo/bin:${process.env.PATH}`,
    },
  },
);
if (result.error)
  console.error(
    "Install the Solana SBF toolchain or set CARGO_BUILD_SBF to its executable path.",
  );
if (result.status === 0) {
  const fixture = process.argv.includes("--test-fixtures");
  const out = process.argv.includes("--venue-adapter")
    ? ".evangel/venue-release"
    : process.argv.includes("--venue-candidate")
      ? ".evangel/venue-programs"
      : fixture
        ? ".evangel/test-programs"
        : "solana/program/target/deploy";
  writeFileSync(
    `${out}/build.json`,
    JSON.stringify({
      version: 3,
      testFixtures: fixture,
      venueCandidate: process.argv.includes("--venue-candidate"),
      venueAdapter: modes.some((x) => x.startsWith("--venue-")),
      binarySha256: createHash("sha256")
        .update(readFileSync(`${out}/evangel_factory.so`))
        .digest("hex"),
    }),
  );
}
process.exit(result.status ?? 1);

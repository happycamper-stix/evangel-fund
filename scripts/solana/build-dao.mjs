import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const local = ".evangel/toolchain/solana-release/bin/cargo-build-sbf";
const result = spawnSync(
  process.env.CARGO_BUILD_SBF ||
    (existsSync(local) ? local : "cargo-build-sbf"),
  [
    "--manifest-path",
    "solana/dao/Cargo.toml",
    "--sbf-out-dir",
    ".evangel/dao-programs",
    "--jobs",
    "2",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: `${homedir()}/.cargo/bin:${process.env.PATH}`,
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
const bytes = readFileSync(".evangel/dao-programs/evangel_dao.so");
writeFileSync(
  ".evangel/dao-programs/build.json",
  JSON.stringify(
    {
      status: "local candidate only",
      binarySha256: createHash("sha256").update(bytes).digest("hex"),
      binaryLength: bytes.length,
    },
    null,
    2,
  ) + "\n",
);

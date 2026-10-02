import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyProgramBytes } from "../lib/solana/program-integrity.mjs";
test("program monitor rejects code changes including bytes beyond reviewed binary", () => {
  const bytes = Buffer.from([1, 2, 3]);
  const baseline = {
    binaryLength: 3,
    binarySha256: createHash("sha256").update(bytes).digest("hex"),
  };
  assert.equal(verifyProgramBytes(bytes, baseline), true);
  assert.equal(
    verifyProgramBytes(Buffer.from([1, 2, 3, 0, 0]), baseline),
    true,
  );
  for (const changed of [
    [1, 2],
    [1, 2, 4],
    [1, 2, 3, 0, 1],
  ])
    assert.throws(() => verifyProgramBytes(Buffer.from(changed), baseline));
  assert.throws(() => verifyProgramBytes(bytes, {}));
});

test("missing deployment configuration fails the monitor instead of reporting a successful check", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  await assert.rejects(
    promisify(execFile)(process.execPath, ["scripts/solana/monitor.mjs"], {
      env: {
        ...process.env,
        EVANGEL_SOLANA_PROGRAM: "",
        EVANGEL_GOVERNANCE_MULTISIG: "",
        NEXT_PUBLIC_EVANGEL_SOLANA_CLUSTER: "devnet",
      },
    }),
    (error) => error.code === 1 && JSON.parse(error.stdout).status === "alert",
  );
});

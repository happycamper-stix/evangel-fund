// One supervised cycle. No scheduler, private key export, or automatic funding.
import { mkdir, writeFile, rename, rmdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { ROOT, assertDevelopmentCluster } from "./runtime.mjs";
await assertDevelopmentCluster();
await mkdir(ROOT, { recursive: true, mode: 0o700 });
const lock = `${ROOT}/keeper-cycle.lock`;
try {
  await mkdir(lock, { mode: 0o700 });
} catch (e) {
  if (e.code === "EEXIST")
    throw Error(
      "A keeper cycle is active or its lock requires recovery. Inspect the previous process before removing the lock.",
    );
  throw e;
}
const report = {
  startedAt: new Date().toISOString(),
  broadcast: process.argv.includes("--broadcast"),
  status: "running",
  steps: [],
};
const run = (file, args = []) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let output = "";
    const capture = (b) => {
      output = (output + b.toString()).slice(-50000);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timeout = setTimeout(() => child.kill("SIGTERM"), 240000);
    child.on("error", () => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: "Could not start keeper step" });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0 && !signal, code, signal, output });
    });
  });
try {
  for (const file of ["monitor.mjs", "collect-fees.mjs", "settle-days.mjs"]) {
    const result = await run(
      `scripts/solana/${file}`,
      report.broadcast && file !== "monitor.mjs" ? ["--broadcast"] : [],
    );
    // Detailed subprocess output remains a private local journal, never a public API response.
    await writeFile(
      `${ROOT}/keeper-${file}.log`,
      result.output || result.reason || "",
      { mode: 0o600 },
    );
    report.steps.push({
      step: file,
      ok: result.ok,
      exitCode: result.code ?? null,
    });
    if (!result.ok)
      throw Error(
        `Keeper step ${file} did not pass; later steps were not run.`,
      );
  }
  report.status = report.broadcast ? "completed" : "dry-run-passed";
} catch (e) {
  report.status = "attention-required";
  report.reason = e.message;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    `${ROOT}/keeper-health.json.tmp`,
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  await rename(`${ROOT}/keeper-health.json.tmp`, `${ROOT}/keeper-health.json`);
  await rmdir(lock);
}
console.log(JSON.stringify(report, null, 2));

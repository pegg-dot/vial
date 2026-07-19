import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";

const requested = process.argv.slice(2);
const files = requested.length > 0
  ? requested
  : readdirSync(resolve("tests/integration"))
      .filter((name) => name.endsWith(".test.ts"))
      .sort()
      .map((name) => `tests/integration/${name}`);

const env = {
  ...process.env,
  VIAL_PGLITE_MEMORY: "true",
  VIAL_SEED_FIXTURES: "true",
  VIAL_SEED_DEMO_ACCOUNTS: "true",
  VIAL_SESSION_SECRET: "integration-session-secret-at-least-32-characters",
  VIAL_PRIVACY_HASH_SECRET: "integration-privacy-secret-at-least-32-characters",
};

function killGroup(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") process.kill(pid, "SIGKILL");
    else process.kill(-pid, "SIGKILL");
  } catch {}
}

function runFile(file, timeoutMs = 90_000) {
  const directory = mkdtempSync(join(tmpdir(), "vial-test-"));
  const logPath = join(directory, "output.log");
  const fd = openSync(logPath, "w");
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", file, "--maxWorkers=1", "--no-file-parallelism"],
      { env, stdio: ["ignore", fd, fd], detached: process.platform !== "win32" },
    );
    let timedOut = false;
    let settled = false;
    const finish = (code, signal, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killGroup(child.pid);
      closeSync(fd);
      let output = "";
      try { output = readFileSync(logPath, "utf8"); } catch {}
      rmSync(directory, { recursive: true, force: true });
      resolveRun({ code, signal, output: error ? `${output}\n${error.stack ?? error.message}` : output, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
      setTimeout(() => finish(null, "SIGKILL"), 250).unref();
    }, timeoutMs);
    child.once("close", (code, signal) => finish(code, signal));
    child.once("error", (error) => finish(1, null, error));
  });
}

for (const file of files) {
  let passed = false;
  for (let attempt = 1; attempt <= 2 && !passed; attempt += 1) {
    process.stdout.write(`[isolated-test] ${file}${attempt > 1 ? " (retry)" : ""}\n`);
    const result = await runFile(file);
    if (result.code === 0) {
      passed = true;
      const match = result.output.match(/Tests\s+(\d+) passed/);
      process.stdout.write(`[isolated-test] passed${match ? ` (${match[1]} tests)` : ""}\n`);
      continue;
    }
    if (result.timedOut && attempt === 1) {
      process.stderr.write(`[isolated-test] ${file} exceeded 90 seconds; retrying in a fresh process.\n`);
      continue;
    }
    process.stderr.write(result.output);
    process.stderr.write(`\n[isolated-test] ${file} failed with code ${result.code ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}.\n`);
    process.exit(result.code ?? 1);
  }
  if (!passed) process.exit(1);
}

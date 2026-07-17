import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkOnly = process.argv.includes("--check");
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const bundleManifest = JSON.parse(await readFile(join(root, "mcpb", "manifest.json"), "utf8"));

assert.equal(bundleManifest.version, packageManifest.version, "MCPB and npm package versions must match");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit" });
  assert.equal(result.status, 0, `${basename(command)} ${args.join(" ")} failed`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "handigraphs-mcpb-"));
const stagingDirectory = join(temporaryDirectory, "bundle");
const artifactName = `handigraphs-stats-api-mcp-${packageManifest.version}.mcpb`;
const outputDirectory = checkOnly ? temporaryDirectory : join(root, "artifacts");
const outputPath = join(outputDirectory, artifactName);
const mcpbExecutable = join(root, "node_modules", ".bin", process.platform === "win32" ? "mcpb.cmd" : "mcpb");

try {
  await mkdir(stagingDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(join(root, "mcpb", "manifest.json"), join(stagingDirectory, "manifest.json"));
  await cp(join(root, "mcpb", ".mcpbignore"), join(stagingDirectory, ".mcpbignore"));
  await cp(join(root, "dist"), join(stagingDirectory, "dist"), { recursive: true });
  for (const file of ["package.json", "package-lock.json", "README.md", "SECURITY.md", "LICENSE"]) {
    await cp(join(root, file), join(stagingDirectory, file));
  }

  run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], stagingDirectory);
  run(mcpbExecutable, ["validate", stagingDirectory], root);
  run(mcpbExecutable, ["pack", stagingDirectory, outputPath], root);
  run(mcpbExecutable, ["info", outputPath], root);

  const artifact = await stat(outputPath);
  assert.ok(artifact.size > 0, "MCPB artifact must not be empty");
  process.stdout.write(`${checkOnly ? "MCPB check passed" : "MCPB created"}: ${outputPath} (${artifact.size} bytes)\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

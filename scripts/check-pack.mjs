import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "handigraphs-mcp-pack-"));
try {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--pack-destination", directory, "--ignore-scripts"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout)[0];
  const files = report.files.map((item) => item.path).sort();
  for (const required of ["CHANGELOG.md", "LICENSE", "README.md", "SECURITY.md", "dist/index.js", "package.json"]) assert.ok(files.includes(required), `missing ${required}`);
  assert.equal(files.some((file) => file.startsWith("src/") || file.startsWith("tests/") || file === ".env"), false, `unexpected pack content: ${files.join(", ")}`);
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.notEqual(manifest.private, true);
  assert.equal(manifest.license, "Apache-2.0");
  assert.equal(manifest.publishConfig?.access, "public");
  assert.equal(manifest.repository?.url, "git+https://github.com/Handigraphs/handigraphs-stats-api-mcp.git");
  console.log(`pack check passed (${report.entryCount} files, ${report.unpackedSize} unpacked bytes)`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

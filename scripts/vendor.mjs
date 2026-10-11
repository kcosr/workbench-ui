#!/usr/bin/env node
// Copy a committed kit snapshot, or verify a consumer against its recorded Git tree.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareFiles,
  filesUnder,
  readPin,
  sha256,
  verifyCopy,
} from "./verify-vendor.mjs";

const kit = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) =>
  execFileSync("git", ["-C", kit, ...args], {
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const gitText = (...args) =>
  git(...args)
    .toString("utf8")
    .trim();
const inside = (child, parent) =>
  child === parent || child.startsWith(parent + sep);

function resolvedDestination(path) {
  if (existsSync(path)) {
    if (lstatSync(path).isSymbolicLink())
      throw new Error(`refusing a symlink destination: ${path}`);
    return realpathSync(path);
  }
  return join(resolvedDestination(dirname(path)), basename(path));
}

function snapshot(commit) {
  const files = new Map();
  for (const entry of git("ls-tree", "-rz", "--full-tree", commit, "--", "src")
    .toString("utf8")
    .split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const [mode, type, oid] = entry.slice(0, tab).split(" ");
    const path = entry.slice(tab + 1);
    if (
      type !== "blob" ||
      (mode !== "100644" && mode !== "100755") ||
      !path.startsWith("src/")
    )
      throw new Error(`unsupported source entry: ${path}`);
    const name = path.slice(4);
    if (["VENDORED.md", "VENDORED.json", "verify-vendor.mjs"].includes(name))
      throw new Error(`reserved source path: ${name}`);
    files.set(name, {
      bytes: git("cat-file", "blob", oid),
      mode: Number.parseInt(mode, 8) & 0o777,
    });
  }
  if (!files.size)
    throw new Error(`no kit source at recorded commit ${commit}`);
  // Derive the complete distribution from the recorded commit. Older pinned
  // snapshots predate the portable verifier; their source is still checked
  // against Git before upgrading them to the current distribution.
  const verifier = gitText(
    "ls-tree",
    commit,
    "--",
    "scripts/verify-vendor.mjs",
  );
  if (verifier)
    files.set("verify-vendor.mjs", {
      bytes: git("show", `${commit}:scripts/verify-vendor.mjs`),
      mode: 0o644,
    });
  const hashes = Object.fromEntries(
    [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, file]) => [name, sha256(file.bytes)]),
  );
  return { files, hashes };
}

function verifyAgainstGit(dest) {
  const actual = filesUnder(dest);
  const pin = readPin(dest);
  let expected;
  try {
    expected = snapshot(pin);
  } catch (error) {
    throw new Error(
      `cannot verify recorded kit commit ${pin}; fetch its history before updating: ${error.message}`,
    );
  }
  compareFiles(dest, expected.hashes);
  if (expected.files.has("verify-vendor.mjs")) {
    verifyCopy(dest);
    const manifest = JSON.parse(
      readFileSync(join(dest, "VENDORED.json"), "utf8"),
    );
    if (
      JSON.stringify(Object.entries(manifest.files).sort()) !==
      JSON.stringify(Object.entries(expected.hashes).sort())
    )
      throw new Error("vendor manifest differs from the recorded Git tree");
  } else if (actual.includes("VENDORED.json")) {
    throw new Error("unexpected manifest for this recorded kit revision");
  }
  return pin;
}

try {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  if (
    args.some((arg) => arg.startsWith("--") && arg !== "--check") ||
    positional.length !== 1 ||
    args.filter((arg) => arg === "--check").length > 1
  ) {
    throw new Error("usage: node scripts/vendor.mjs <destination> [--check]");
  }
  const dest = resolvedDestination(resolve(positional[0]));
  const canonicalKit = realpathSync(kit);
  if (inside(canonicalKit, dest) || inside(dest, canonicalKit))
    throw new Error(`destination overlaps kit: ${dest}`);
  if (check) {
    const pin = verifyAgainstGit(dest);
    process.stdout.write(
      `workbench-ui ${pin}: vendored copy matches the recorded Git tree\n`,
    );
  } else {
    const commit = gitText("rev-parse", "HEAD");
    const dirty = gitText(
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--ignored",
      "--",
      "src",
      "scripts/verify-vendor.mjs",
    );
    if (dirty)
      throw new Error(
        "src/ or the portable verifier has uncommitted changes; commit them before vendoring",
      );
    const source = snapshot(commit);
    if (!source.files.has("verify-vendor.mjs"))
      throw new Error("commit the portable verifier before vendoring");
    if (existsSync(dest)) {
      if (!lstatSync(dest).isDirectory())
        throw new Error(`not a directory: ${dest}`);
      if (readdirSync(dest).length) verifyAgainstGit(dest);
    }
    mkdirSync(dirname(dest), { recursive: true });
    const stage = mkdtempSync(join(dirname(dest), ".workbench-vendor-"));
    const next = join(stage, "next");
    const previous = join(stage, "previous");
    let installed = false;
    try {
      mkdirSync(next);
      for (const [name, file] of source.files) {
        const path = join(next, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.bytes);
        chmodSync(path, file.mode);
      }
      writeFileSync(
        join(next, "VENDORED.json"),
        `${JSON.stringify({ commit, files: source.hashes }, null, 2)}\n`,
      );
      writeFileSync(
        join(next, "VENDORED.md"),
        `# Vendored workbench-ui\n\nDo not edit; change workbench-ui and re-vendor.\n\n- Kit commit: \`${commit}\`\n- Vendored on: ${new Date().toISOString().slice(0, 10)}\n\nCheck this copy with \`node verify-vendor.mjs\` from this directory.\n\nRe-vendor from the workbench-ui repo with\n\`node scripts/vendor.mjs <this directory>\`.\n`,
      );
      verifyCopy(next);
      if (existsSync(dest)) {
        if (readdirSync(dest).length) verifyAgainstGit(dest);
        renameSync(dest, previous);
      }
      try {
        renameSync(next, dest);
        installed = true;
      } catch (error) {
        if (existsSync(previous)) {
          try {
            renameSync(previous, dest);
          } catch (restoreError) {
            throw new Error(
              `update failed (${error.message}); restore failed (${restoreError.message}); original copy retained at ${previous}`,
            );
          }
        }
        throw error;
      }
    } finally {
      if (installed || !existsSync(previous))
        rmSync(stage, { recursive: true, force: true });
    }
    process.stdout.write(`vendored workbench-ui ${commit} into ${dest}\n`);
  }
} catch (error) {
  process.stderr.write(`vendor: ${error.message}\n`);
  process.exitCode = 1;
}

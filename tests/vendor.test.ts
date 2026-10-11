import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import * as prettier from "prettier";

const kit = resolve(__dirname, "..");
const work = mkdtempSync(join(tmpdir(), "wb-vendor-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function fixture({ legacy = false } = {}) {
  const area = mkdtempSync(join(work, "fixture-"));
  const repo = join(area, "kit");
  const dest = join(area, "app", "src", "workbench");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "src", "styles"), { recursive: true });
  for (const name of ["vendor.mjs", "verify-vendor.mjs"]) {
    cpSync(join(kit, "scripts", name), join(repo, "scripts", name));
  }
  cpSync(
    join(kit, "src", ".gitattributes"),
    join(repo, "src", ".gitattributes"),
  );
  writeFileSync(join(repo, "src", "index.ts"), "export const version = 1;\n");
  writeFileSync(
    join(repo, "src", "styles", "index.css"),
    ":root { --test: 1; }\n",
  );
  writeFileSync(join(repo, "src", "obsolete.ts"), "export {};\n");
  writeFileSync(join(repo, "src", "run.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(repo, "src", "run.sh"), 0o755);
  writeFileSync(join(repo, ".gitignore"), "*.log\n");
  execFileSync("git", ["init", "-q", repo]);
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "core.autocrlf=false",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        ...args,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  const commit = (message = "fixture") => {
    git("add", "-A");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  let legacyPin: string | undefined;
  if (legacy) {
    git("add", "src", ".gitignore", "scripts/vendor.mjs");
    git("commit", "-qm", "legacy source without portable verifier");
    legacyPin = git("rev-parse", "HEAD");
  }
  const pin = commit();
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [join(repo, "scripts", "vendor.mjs"), ...args],
      { encoding: "utf8" },
    );
  const portable = () =>
    spawnSync(process.execPath, [join(dest, "verify-vendor.mjs")], {
      cwd: area,
      encoding: "utf8",
    });
  const vendor = () => {
    const result = run(dest);
    expect(result.status, result.stderr).toBe(0);
  };
  const upgrade = () => {
    writeFileSync(join(repo, "src", "index.ts"), "export const version = 2;\n");
    rmSync(join(repo, "src", "obsolete.ts"));
    writeFileSync(join(repo, "src", "new.ts"), "export const added = true;\n");
    return commit("upgrade source");
  };
  const legacyCopy = () => {
    cpSync(join(repo, "src"), dest, { recursive: true });
    writeFileSync(
      join(dest, "VENDORED.md"),
      `# Vendored workbench-ui\n\n- Kit commit: \`${legacyPin}\`\n`,
    );
  };
  return {
    area,
    repo,
    dest,
    pin,
    legacyPin,
    git,
    commit,
    run,
    portable,
    vendor,
    upgrade,
    legacyCopy,
  };
}

function bytes(path: string) {
  return readFileSync(path, "utf8");
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function manifest(dest: string) {
  return JSON.parse(bytes(join(dest, "VENDORED.json"))) as {
    commit: string;
    files: Record<string, string>;
  };
}
function writeManifest(dest: string, value: ReturnType<typeof manifest>) {
  writeFileSync(
    join(dest, "VENDORED.json"),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

// Every case runs against a temporary committed Git fixture. The working kit may
// be dirty, and no remote, global Git identity or live source commit is required.
describe("committed kit distribution", () => {
  it("copies committed source, executable modes, a portable verifier and formatted provenance", async () => {
    const f = fixture();
    f.vendor();
    expect(bytes(join(f.dest, "index.ts"))).toBe(
      bytes(join(f.repo, "src", "index.ts")),
    );
    expect(statSync(join(f.dest, "run.sh")).mode & 0o777).toBe(0o755);
    expect(bytes(join(f.dest, "verify-vendor.mjs"))).toBe(
      bytes(join(f.repo, "scripts", "verify-vendor.mjs")),
    );
    const note = bytes(join(f.dest, "VENDORED.md"));
    expect(note).toContain(`\`${f.pin}\``);
    expect(note).toContain("Do not edit; change workbench-ui and re-vendor");
    expect(note).toMatch(/Vendored on: \d{4}-\d{2}-\d{2}/);
    expect(await prettier.format(note, { parser: "markdown" })).toBe(note);
    expect(manifest(f.dest).files["index.ts"]).toBe(
      hash(bytes(join(f.dest, "index.ts"))),
    );
    expect(f.run(f.dest, "--check").status).toBe(0);
    expect(f.portable().status).toBe(0);
    expect(readdirSync(join(f.area, "app", "src"))).toEqual(["workbench"]);
  });

  it("preserves the complete snapshot when a consumer checks out with core.autocrlf=true", () => {
    const f = fixture();
    f.vendor();
    const consumer = join(f.area, "app");
    const checkout = join(f.area, "windows-checkout");
    writeFileSync(join(consumer, ".gitattributes"), "* text=auto\n");
    writeFileSync(join(consumer, "README.txt"), "consumer file\nsecond line\n");
    execFileSync("git", ["init", "-q", consumer]);
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        [
          "-C",
          consumer,
          "-c",
          "core.autocrlf=false",
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          ...args,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    git("add", "-A");
    git("commit", "-qm", "commit consumer snapshot");
    execFileSync(
      "git",
      [
        "-c",
        "core.autocrlf=true",
        "clone",
        "--no-local",
        "--quiet",
        consumer,
        checkout,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    // Prove the checkout actually applied CRLF conversion outside the snapshot.
    expect(bytes(join(checkout, "README.txt"))).toBe(
      "consumer file\r\nsecond line\r\n",
    );
    const copied = join(checkout, "src", "workbench");
    for (const name of [
      ...Object.keys(manifest(f.dest).files),
      "VENDORED.md",
      "VENDORED.json",
    ]) {
      expect(readFileSync(join(copied, name)), name).toEqual(
        readFileSync(join(f.dest, name)),
      );
    }
    const portable = spawnSync(
      process.execPath,
      [join(copied, "verify-vendor.mjs")],
      { encoding: "utf8" },
    );
    expect(portable.status, portable.stderr).toBe(0);
    const authoritative = f.run(copied, "--check");
    expect(authoritative.status, authoritative.stderr).toBe(0);
  });

  it("checks the recorded revision and upgrades an intact old snapshot to changed files", () => {
    const f = fixture();
    f.vendor();
    const next = f.upgrade();
    const oldNote = bytes(join(f.dest, "VENDORED.md"));
    expect(f.run(f.dest, "--check").status).toBe(0);
    expect(bytes(join(f.dest, "VENDORED.md"))).toBe(oldNote);
    f.vendor();
    expect(manifest(f.dest).commit).toBe(next);
    expect(bytes(join(f.dest, "index.ts"))).toContain("version = 2");
    expect(existsSync(join(f.dest, "obsolete.ts"))).toBe(false);
    expect(existsSync(join(f.dest, "new.ts"))).toBe(true);
    expect(f.portable().status).toBe(0);
  });

  it("checks and upgrades an exact legacy Git snapshot lacking portable provenance", () => {
    const f = fixture({ legacy: true });
    f.legacyCopy();
    f.upgrade();
    expect(f.run(f.dest, "--check").status).toBe(0);
    f.vendor();
    expect(f.portable().status).toBe(0);
    expect(existsSync(join(f.dest, "obsolete.ts"))).toBe(false);
  });

  it("rejects a modified legacy copy before replacing it", () => {
    const f = fixture({ legacy: true });
    f.legacyCopy();
    writeFileSync(join(f.dest, "index.ts"), "consumer change\n");
    f.upgrade();
    const result = f.run(f.dest);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("modified: index.ts");
    expect(bytes(join(f.dest, "index.ts"))).toBe("consumer change\n");
    expect(existsSync(join(f.dest, "VENDORED.json"))).toBe(false);
  });

  it("can check recorded consumer bytes even while the current source checkout is dirty", () => {
    const f = fixture();
    f.vendor();
    writeFileSync(join(f.repo, "src", "index.ts"), "in-progress source edit\n");
    expect(f.run(f.dest, "--check").status).toBe(0);
    expect(f.run(f.dest).status).toBe(1);
    expect(bytes(join(f.dest, "index.ts"))).toContain("version = 1");
  });

  it("checks a distribution without the original kit checkout", () => {
    const f = fixture();
    f.vendor();
    rmSync(f.repo, { recursive: true });
    expect(f.portable().status).toBe(0);
    writeFileSync(join(f.dest, "index.ts"), "changed\n");
    expect(f.portable().stderr).toContain("modified: index.ts");
  });

  it("verifies rather than silently succeeding through a symlinked parent directory", () => {
    const f = fixture();
    f.vendor();
    const link = join(f.area, "linked-app");
    symlinkSync(join(f.area, "app"), link, "junction");
    const verify = () =>
      spawnSync(
        process.execPath,
        [join(link, "src", "workbench", "verify-vendor.mjs")],
        {
          encoding: "utf8",
        },
      );
    const clean = verify();
    expect(clean.status, clean.stderr).toBe(0);
    expect(clean.stdout).toContain(
      "vendored files match their recorded checksums",
    );
    writeFileSync(join(f.dest, "index.ts"), "changed through real path\n");
    const drift = verify();
    expect(drift.status).toBe(1);
    expect(drift.stderr).toContain("modified: index.ts");
  });
});

describe("consumer drift protection", () => {
  it.each([
    [
      "modified",
      "index.ts",
      (path: string) => writeFileSync(path, "consumer change\n"),
    ],
    ["missing", "index.ts", (path: string) => rmSync(path)],
    [
      "added",
      "extra.ts",
      (path: string) => writeFileSync(path, "consumer extra\n"),
    ],
    [
      "added",
      "debug.log",
      (path: string) => writeFileSync(path, "ignored by Git, still drift\n"),
    ],
    [
      "modified",
      "verify-vendor.mjs",
      (path: string) => writeFileSync(path, "// edited checker\n"),
    ],
  ] as const)("refuses %s %s before overwrite", (kind, name, mutate) => {
    const f = fixture();
    f.vendor();
    const pinBefore = bytes(join(f.dest, "VENDORED.md"));
    mutate(join(f.dest, name));
    f.upgrade();
    const before = existsSync(join(f.dest, name))
      ? bytes(join(f.dest, name))
      : null;
    for (const args of [[f.dest, "--check"], [f.dest]]) {
      const result = f.run(...args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${kind}: ${name}`);
    }
    expect(bytes(join(f.dest, "VENDORED.md"))).toBe(pinBefore);
    expect(
      existsSync(join(f.dest, name)) ? bytes(join(f.dest, name)) : null,
    ).toBe(before);
    expect(existsSync(join(f.dest, "new.ts"))).toBe(false);
    expect(readdirSync(join(f.area, "app", "src"))).toEqual(["workbench"]);
  });

  it.each(["modified", "missing", "added"])(
    "portable checker reports %s drift",
    (kind) => {
      const f = fixture();
      f.vendor();
      if (kind === "modified")
        writeFileSync(join(f.dest, "index.ts"), "changed\n");
      else if (kind === "missing") rmSync(join(f.dest, "index.ts"));
      else writeFileSync(join(f.dest, "debug.log"), "extra\n");
      const result = f.portable();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${kind}:`);
    },
  );

  it("rejects missing portable verification files before an upgrade", () => {
    for (const name of ["verify-vendor.mjs", "VENDORED.json"]) {
      const f = fixture();
      f.vendor();
      rmSync(join(f.dest, name));
      f.upgrade();
      const result = f.run(f.dest);
      expect(result.status).toBe(1);
      expect(bytes(join(f.dest, "index.ts"))).toContain("version = 1");
      expect(existsSync(join(f.dest, name))).toBe(false);
    }
  });

  it("uses Git as authority when a consumer edits both source and its checksum manifest", () => {
    const f = fixture();
    f.vendor();
    const changed = "export const version = 'consumer';\n";
    writeFileSync(join(f.dest, "index.ts"), changed);
    const record = manifest(f.dest);
    record.files["index.ts"] = hash(changed);
    writeManifest(f.dest, record);
    // Portable checks prove local consistency; only Git-backed checks establish
    // that those bytes belong to the recorded source revision.
    expect(f.portable().status).toBe(0);
    for (const args of [[f.dest, "--check"], [f.dest]]) {
      const result = f.run(...args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("modified: index.ts");
    }
    expect(bytes(join(f.dest, "index.ts"))).toBe(changed);
  });

  it("rejects changed manifest hashes and revision mismatch", () => {
    const f = fixture();
    f.vendor();
    const record = manifest(f.dest);
    record.files["index.ts"] = "a".repeat(64);
    writeManifest(f.dest, record);
    expect(f.portable().status).toBe(1);
    expect(f.run(f.dest).status).toBe(1);
    record.files["index.ts"] = hash(bytes(join(f.dest, "index.ts")));
    record.commit = "f".repeat(40);
    writeManifest(f.dest, record);
    expect(f.portable().stderr).toContain(
      "does not describe the recorded kit commit",
    );
    expect(f.run(f.dest).status).toBe(1);
  });

  it.each(["../escape", "/absolute", "nested\\escape", "VENDORED.md"])(
    "portable checker rejects invalid manifest path %s",
    (name) => {
      const f = fixture();
      f.vendor();
      const record = manifest(f.dest);
      record.files[name] = "a".repeat(64);
      writeManifest(f.dest, record);
      const result = f.portable();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("invalid vendor manifest entry");
    },
  );

  it.each(["missing", "invalid", "duplicate", "unknown"])(
    "rejects %s commit provenance",
    (kind) => {
      const f = fixture();
      f.vendor();
      const path = join(f.dest, "VENDORED.md");
      if (kind === "missing") rmSync(path);
      else if (kind === "invalid")
        writeFileSync(path, "- Kit commit: `dirty`\n");
      else if (kind === "duplicate")
        writeFileSync(path, `${bytes(path)}\n- Kit commit: \`${f.pin}\`\n`);
      else writeFileSync(path, `- Kit commit: \`${"f".repeat(40)}\`\n`);
      const before = bytes(join(f.dest, "index.ts"));
      const result = f.run(f.dest);
      expect(result.status).toBe(1);
      if (kind === "unknown")
        expect(result.stderr).toContain("fetch its history before updating");
      expect(bytes(join(f.dest, "index.ts"))).toBe(before);
    },
  );
});

describe("source and destination safety", () => {
  it("allows unrelated dirty work while the committed source and verifier remain intact", () => {
    const f = fixture();
    writeFileSync(join(f.repo, "notes.txt"), "uncommitted research\n");
    f.vendor();
    expect(manifest(f.dest).commit).toBe(f.pin);
  });

  it.each([
    ["modified", "src/index.ts"],
    ["untracked", "src/new.ts"],
    ["ignored", "src/debug.log"],
    ["verifier", "scripts/verify-vendor.mjs"],
  ])("rejects %s source changes without a dirty override", (_, name) => {
    const f = fixture();
    writeFileSync(
      join(f.repo, name!),
      `${bytes(join(f.repo, "scripts", "verify-vendor.mjs"))}\n// changed\n`,
    );
    const result = f.run(f.dest);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("uncommitted changes");
    expect(existsSync(f.dest)).toBe(false);
    expect(f.run(f.dest, "--allow-dirty").status).toBe(1);
  });

  it("requires the verifier to be present in the selected source commit", () => {
    const f = fixture();
    f.git("rm", "--cached", "scripts/verify-vendor.mjs");
    f.git("commit", "-qm", "remove verifier from source history");
    // The untracked checker still permits execution, but cannot be distributed.
    expect(f.run(f.dest).status).toBe(1);
    expect(existsSync(f.dest)).toBe(false);
  });

  it("does not replace non-kit contents or ordinary files", () => {
    const f = fixture();
    mkdirSync(f.dest, { recursive: true });
    writeFileSync(join(f.dest, "precious.txt"), "keep me\n");
    expect(f.run(f.dest).status).toBe(1);
    expect(bytes(join(f.dest, "precious.txt"))).toBe("keep me\n");
    const file = join(f.area, "ordinary-file");
    writeFileSync(file, "keep me too\n");
    expect(f.run(file).status).toBe(1);
    expect(bytes(file)).toBe("keep me too\n");
  });

  it("rejects destinations inside the kit, its ancestors and symlink aliases into source", () => {
    const f = fixture();
    for (const destination of [
      f.repo,
      join(f.repo, "src"),
      join(f.repo, "nested", "copy"),
      f.area,
    ]) {
      expect(f.run(destination).status).toBe(1);
    }
    const alias = join(f.area, "source-alias");
    symlinkSync(join(f.repo, "src"), alias);
    expect(f.run(alias).status).toBe(1);
    expect(f.run(join(alias, "new-copy")).status).toBe(1);
    expect(bytes(join(f.repo, "src", "index.ts"))).toContain("version = 1");
  });

  it.each(["index.ts", "VENDORED.md", "VENDORED.json"])(
    "rejects symlinked consumer %s before reading outside files",
    (name) => {
      const f = fixture();
      f.vendor();
      const external = join(f.area, "external");
      writeFileSync(external, bytes(join(f.dest, name)));
      rmSync(join(f.dest, name));
      symlinkSync(external, join(f.dest, name));
      const result = f.run(f.dest);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("symlink is not a vendored file");
      expect(f.portable().status).toBe(1);
      expect(existsSync(external)).toBe(true);
    },
  );

  it("rejects committed source symlinks and reserved provenance paths", () => {
    const f = fixture();
    symlinkSync("index.ts", join(f.repo, "src", "link.ts"));
    f.commit("source symlink");
    expect(f.run(f.dest).stderr).toContain("unsupported source entry");
    expect(existsSync(f.dest)).toBe(false);
    rmSync(join(f.repo, "src", "link.ts"));
    writeFileSync(join(f.repo, "src", "VENDORED.json"), "{}\n");
    f.commit("reserved provenance name");
    expect(f.run(f.dest).stderr).toContain("reserved source path");
    expect(existsSync(f.dest)).toBe(false);
  });
});

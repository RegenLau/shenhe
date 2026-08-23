#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    i += 1;
  }
  return values;
}

function normalizeSlug(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) throw new Error("--slug must contain at least one letter or number");
  return slug;
}

function replaceTokens(source, tokens) {
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in tokens)) throw new Error(`Template token has no value: ${key}`);
    return String(tokens[key]);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const device = args.device;
  if (!['web', 'mobile'].includes(device)) throw new Error("--device must be web or mobile");
  const modeInput = args.mode;
  if (!['reconstruction', 'adaptation', 'independent-planning'].includes(modeInput)) {
    throw new Error("--mode must be reconstruction, adaptation, or independent-planning");
  }
  const mode = modeInput === "independent-planning" ? "independent planning" : modeInput;
  if (!args.slug) throw new Error("--slug is required");

  const slug = normalizeSlug(args.slug);
  const title = (args.title || slug.replace(/-/g, " ")).trim();
  const root = path.resolve(args.root || process.cwd());
  const taskDir = path.join(root, ".ai-to-figma", slug);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const assetDir = path.resolve(scriptDir, "..", "assets");
  const width = device === "web" ? 1440 : 375;
  const minHeight = device === "web" ? 900 : 812;

  await mkdir(path.dirname(taskDir), { recursive: true });
  await mkdir(taskDir, { recursive: false });
  await Promise.all([
    mkdir(path.join(taskDir, "assets", "originals"), { recursive: true }),
    mkdir(path.join(taskDir, "assets", "working"), { recursive: true }),
    mkdir(path.join(taskDir, "assets", "final"), { recursive: true }),
    mkdir(path.join(taskDir, "previews"), { recursive: true }),
  ]);

  const [specTemplate, runtimeManifest] = await Promise.all([
    readFile(path.join(assetDir, "design-spec-template.md"), "utf8"),
    readFile(path.resolve(scriptDir, "..", "package.json"), "utf8").then(JSON.parse),
  ]);
  const mingcuteVersion = runtimeManifest.dependencies?.["@mingcute/svg"];
  if (!/^\d+\.\d+\.\d+$/.test(mingcuteVersion || "")) {
    throw new Error("@mingcute/svg must be pinned to an exact version in the Skill package.json");
  }

  const common = {
    TITLE: title,
    DEVICE: device,
    WIDTH: width,
    MIN_HEIGHT: minHeight,
    MINGCUTE_VERSION: mingcuteVersion,
    MODE: mode,
    DIRECTION_SOURCE: mode === "adaptation"
      ? "reference-style-profile"
      : mode === "independent planning" ? "brief-derived" : "reconstruction-reference",
    PREVIEW_REQUIREMENT: mode === "reconstruction" ? "not-required" : "required",
    PREVIEW_INITIAL: mode === "reconstruction" ? "not-required" : "pending",
  };
  const spec = replaceTokens(specTemplate, common);
  const report = {
    schemaVersion: 3,
    slug,
    title,
    device,
    mode,
    expectedWidth: width,
    minimumHeight: minHeight,
    visualDirection: mode === "reconstruction" ? "not-required" : "pending",
    typographyResolution: "pending",
    visualInventory: "pending",
    assetResolution: "pending",
    htmlInitialized: "pending",
    localValidation: "pending",
    visualValidation: "pending",
    figmaCapture: "pending",
    figmaVerification: "pending",
  };

  await Promise.all([
    writeFile(path.join(taskDir, "design.md"), spec, { flag: "wx" }),
    writeFile(path.join(taskDir, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" }),
  ]);

  process.stdout.write(`${JSON.stringify({ taskDir, device, width, minHeight })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

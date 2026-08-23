#!/usr/bin/env node

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values[arg.slice(2)] = value;
    i += 1;
  }
  return values;
}

function validateName(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || "")) {
    throw new Error("--name must be a kebab-case MingCute icon name");
  }
  return value;
}

function validateStyle(value) {
  if (!["regular", "filled"].includes(value)) {
    throw new Error("--style must be regular or filled");
  }
  return value;
}

function validateVisualId(value) {
  if (value === undefined) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("--visual-id must be a kebab-case Visual Asset Plan ID");
  }
  return value;
}

function normalizeCanonicalPaint(source) {
  return source
    .replace(/<div\b([^>]*)\/>/g, "<div$1></div>")
    .replace(/rgb\(16 22 31 \/ (0(?:\.\d+)?|1(?:\.0+)?)\)/g, (_, alpha) => {
      const percentage = Number(alpha) * 100;
      return percentage === 0
        ? "transparent"
        : `color-mix(in srgb, currentColor ${percentage}%, transparent)`;
    })
    .replace(/rgb\(16 22 31\)/g, "currentColor");
}

function prepareSvg(source, name, style, visualId) {
  const normalized = normalizeCanonicalPaint(source);
  if (!/^<svg\b/i.test(normalized.trim())) throw new Error("MingCute source is not an SVG document");
  if (!/\bviewBox=["']0 0 24 24["']/i.test(normalized)) throw new Error("MingCute SVG must use viewBox 0 0 24 24");
  if (!/\bcurrentColor\b/.test(normalized)) throw new Error("MingCute SVG must use currentColor");
  if (/<script\b|\bon[a-z]+\s*=|<(?:image|feImage)\b|\b(?:href|xlink:href)\s*=/i.test(normalized)) {
    throw new Error("MingCute SVG must be self-contained and script-free");
  }

  return normalized.trim().replace(/^<svg\b/i, [
    '<svg',
    ' width="24"',
    ' height="24"',
    ' style="display: block; flex: none;"',
    ' aria-hidden="true"',
    ' focusable="false"',
    ` data-mingcute-icon="${name}"`,
    ` data-mingcute-style="${style}"`,
    visualId ? ` data-visual-id="${visualId}"` : "",
  ].join(""));
}

async function replaceAtomically(file, source, marker, replacement) {
  const matches = source.match(marker);
  if (!matches?.length) throw new Error("No matching MingCute placeholder found in target HTML");

  const output = source.replace(marker, replacement);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, output, { flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return matches.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("--file is required");

  const name = validateName(args.name);
  const style = validateStyle(args.style);
  const visualId = validateVisualId(args["visual-id"]);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const skillDir = path.resolve(scriptDir, "..");
  const manifest = JSON.parse(await readFile(path.join(skillDir, "package.json"), "utf8"));
  const version = manifest.dependencies?.["@mingcute/svg"];
  if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
    throw new Error("@mingcute/svg must be pinned to an exact version in the Skill package.json");
  }

  const iconPath = path.join(
    skillDir,
    "node_modules",
    "@mingcute",
    "svg",
    `core-${style}`,
    `${name}.svg`,
  );
  let iconSource;
  try {
    iconSource = await readFile(iconPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`MingCute icon not found: ${style}/${name}. Run npm install --omit=dev --prefix "${skillDir}" first.`);
    }
    throw error;
  }

  const file = path.resolve(args.file);
  const html = await readFile(file, "utf8");
  const marker = new RegExp(`<!--\\s*mingcute:${style}:${name}\\s*-->`, "g");
  const replacements = await replaceAtomically(file, html, marker, prepareSvg(iconSource, name, style, visualId));
  process.stdout.write(`${JSON.stringify({ file, name, style, visualId, version, replacements })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

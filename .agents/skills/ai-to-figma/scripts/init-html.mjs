#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDesign } from "./lib/visual-plan.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values[arg.slice(2)] = value;
    index += 1;
  }
  return values;
}

function replaceTokens(source, tokens) {
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in tokens)) throw new Error(`Template token has no value: ${key}`);
    return String(tokens[key]);
  });
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mobileContent() {
  return `    <header data-ios-status-bar aria-label="iOS status bar">
      <span class="ios-time">9:41</span>
      <span class="ios-status-icons" aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/>
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 4.5C4.9 1.1 11.1 1.1 15 4.5M3.6 7.1C6 5.1 10 5.1 12.4 7.1M6.3 9.5C7.3 8.8 8.7 8.8 9.7 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.75" y="0.75" width="21.5" height="10.5" rx="3.25" stroke="currentColor" stroke-width="1.5"/><rect x="2.5" y="2.5" width="18" height="7" rx="1.8" fill="currentColor"/><path d="M23.5 4V8C24.4 7.7 25 7 25 6C25 5 24.4 4.3 23.5 4Z" fill="currentColor"/>
        </svg>
      </span>
    </header>
    <section class="screen-content" data-ios-content>
      <!-- Replace with product content. -->
    </section>
    <footer data-ios-home-area aria-label="iOS home indicator area">
      <div data-ios-home-indicator></div>
    </footer>`;
}

function webContent() {
  return `    <section class="screen-content">
      <!-- Replace with product content. -->
    </section>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) throw new Error("--dir is required");

  const taskDir = path.resolve(args.dir);
  const designPath = path.join(taskDir, "design.md");
  const reportPath = path.join(taskDir, "validation-report.json");
  const htmlPath = path.join(taskDir, "index.html");
  const validation = await validateDesign(designPath);
  if (!validation.valid) {
    for (const error of validation.errors) process.stderr.write(`ERROR: ${error}\n`);
    throw new Error("Design plan gate failed; index.html was not created");
  }

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.schemaVersion !== 3) throw new Error("validation-report.json must use schemaVersion 3");
  if (!new Set(["web", "mobile"]).has(report.device)) throw new Error("validation-report.json has an invalid device");
  if (validation.device && validation.device !== report.device) throw new Error("design.md device does not match validation-report.json");
  if (validation.visualDirection.mode !== report.mode) throw new Error("design.md mode does not match validation-report.json");

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const template = await readFile(path.resolve(scriptDir, "..", "assets", "capture-shell.html"), "utf8");
  const html = replaceTokens(template, {
    TITLE: report.title || report.slug.replace(/-/g, " "),
    DEVICE: report.device,
    WIDTH: report.expectedWidth,
    MIN_HEIGHT: report.minimumHeight,
    UI_FONT: escapeHtmlAttribute(validation.typography.resolvedUiFont),
    UI_FONT_STACK: validation.typography.uiFontStack,
    REQUIRED_LOCAL_FONTS: escapeHtmlAttribute(validation.typography.requiredLocalFonts.join("|")),
    CAPTURE_CONTENT: report.device === "mobile" ? mobileContent() : webContent(),
  });

  try {
    await writeFile(htmlPath, html, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`index.html already exists: ${htmlPath}`);
    throw error;
  }

  const updatedReport = {
    ...report,
    typographyResolution: "passed",
    visualInventory: "passed",
    assetResolution: "passed",
    visualDirection: validation.visualDirection.status,
    htmlInitialized: "created",
  };
  await writeFile(reportPath, `${JSON.stringify(updatedReport, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ taskDir, htmlPath, fonts: validation.typography.requiredLocalFonts, assets: validation.assets.length })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

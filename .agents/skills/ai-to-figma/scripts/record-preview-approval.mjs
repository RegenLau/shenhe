#!/usr/bin/env node

import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isInsidePreviewRoot, parseCanvas, parseDesignMode, PREVIEW_REQUIRED_MODES, resolvePreviewPath, sha256File } from "./lib/visual-direction.mjs";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) throw new Error("--dir is required");
  if (!args.file) throw new Error("--file is required");

  const taskDir = path.resolve(args.dir);
  const designPath = path.join(taskDir, "design.md");
  const reportPath = path.join(taskDir, "validation-report.json");
  const htmlPath = path.join(taskDir, "index.html");
  const markdown = await readFile(designPath, "utf8");
  const mode = parseDesignMode(markdown);
  if (!PREVIEW_REQUIRED_MODES.has(mode)) throw new Error(`Visual preview approval is not used for ${mode || "an unresolved"} mode`);

  const previewPath = resolvePreviewPath(taskDir, args.file);
  if (!previewPath) throw new Error("Approved preview must be stored under previews/ in the task directory");
  if (!/\.(?:png|jpe?g|webp)$/i.test(previewPath)) throw new Error("Approved preview must be a PNG, JPEG, or WebP image");
  const previewStat = await stat(previewPath);
  if (!previewStat.isFile()) throw new Error("Approved preview is not a file");
  if (!await isInsidePreviewRoot(taskDir, previewPath)) throw new Error("Approved preview resolves outside previews/");
  try {
    await access(htmlPath);
    throw new Error("HTML already exists; do not replace the approved visual direction after implementation starts");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.schemaVersion !== 3) throw new Error("validation-report.json must use schemaVersion 3");
  if (report.mode !== mode) throw new Error("validation-report.json mode does not match design.md");
  const canvas = parseCanvas(markdown);
  if (canvas.device !== report.device || canvas.width !== report.expectedWidth || canvas.minimumHeight !== report.minimumHeight) {
    throw new Error("Design canvas does not match validation-report.json");
  }

  const relativePreview = path.relative(taskDir, previewPath).split(path.sep).join("/");
  const approval = {
    schemaVersion: 1,
    mode,
    approvedPreview: relativePreview,
    sha256: await sha256File(previewPath),
    approvedAt: new Date().toISOString(),
    canvas,
  };
  const updatedMarkdown = markdown
    .replace(/^- Approved preview:.*$/mi, `- Approved preview: ${relativePreview}`)
    .replace(/^- Approval record:.*$/mi, "- Approval record: preview-approval.json");
  await writeFile(designPath, updatedMarkdown);
  await writeFile(path.join(taskDir, "preview-approval.json"), `${JSON.stringify(approval, null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify({ ...report, visualDirection: "approved" }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(approval)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

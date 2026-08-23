import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const DESIGN_MODES = new Set(["reconstruction", "adaptation", "independent planning"]);
export const PREVIEW_REQUIRED_MODES = new Set(["adaptation", "independent planning"]);

function field(markdown, label) {
  return new RegExp(`^- ${label}:\\s*(.+?)\\s*$`, "mi").exec(markdown)?.[1]?.trim() || null;
}

export function parseDesignMode(markdown) {
  return field(markdown, "Mode");
}

export function parseCanvas(markdown) {
  const device = field(markdown, "Device");
  const width = Number(/^(\d+)px$/.exec(field(markdown, "Width") || "")?.[1]);
  const minimumHeight = Number(/^(\d+)px$/.exec(field(markdown, "Minimum height") || "")?.[1]);
  return { device, width, minimumHeight };
}

export async function sha256File(file) {
  const source = await readFile(file);
  return createHash("sha256").update(source).digest("hex");
}

function safePreviewPath(taskDir, value) {
  if (!value || path.isAbsolute(value)) return null;
  const normalized = value.replaceAll("\\", "/");
  if (!normalized.startsWith("previews/") || normalized.includes("../")) return null;
  const resolved = path.resolve(taskDir, value);
  const previewRoot = `${path.resolve(taskDir, "previews")}${path.sep}`;
  return resolved.startsWith(previewRoot) ? resolved : null;
}

export async function validateVisualDirection(designPath, markdown) {
  const taskDir = path.dirname(path.resolve(designPath));
  const mode = parseDesignMode(markdown);
  const errors = [];

  if (!DESIGN_MODES.has(mode)) {
    errors.push("Mode must be reconstruction, adaptation, or independent planning");
    return { mode, status: "pending", approval: null, errors };
  }
  if (!PREVIEW_REQUIRED_MODES.has(mode)) {
    return { mode, status: "not-required", approval: null, errors };
  }

  const approvalPath = path.join(taskDir, "preview-approval.json");
  let approval;
  try {
    approval = JSON.parse(await readFile(approvalPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") errors.push(`Visual preview approval is required for ${mode} mode`);
    else errors.push(`Visual preview approval is unreadable: ${error.message}`);
    return { mode, status: "pending", approval: null, errors };
  }

  if (approval.schemaVersion !== 1) errors.push("Visual preview approval must use schemaVersion 1");
  if (approval.mode !== mode) errors.push("Visual preview approval mode does not match design.md");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(approval.approvedAt || "")) errors.push("Visual preview approval needs an ISO approvedAt timestamp");
  if (!/^[a-f0-9]{64}$/.test(approval.sha256 || "")) errors.push("Visual preview approval needs a SHA-256 hash");

  const canvas = parseCanvas(markdown);
  if (approval.canvas?.device !== canvas.device
    || approval.canvas?.width !== canvas.width
    || approval.canvas?.minimumHeight !== canvas.minimumHeight) {
    errors.push("Visual preview approval canvas does not match design.md");
  }

  const previewPath = safePreviewPath(taskDir, approval.approvedPreview);
  if (!previewPath) {
    errors.push("Approved visual preview must be a relative file under previews/");
  } else {
    try {
      const previewStat = await stat(previewPath);
      if (!previewStat.isFile()) errors.push("Approved visual preview is not a file");
      else if (!await isInsidePreviewRoot(taskDir, previewPath)) errors.push("Approved visual preview resolves outside previews/");
      else if (await sha256File(previewPath) !== approval.sha256) errors.push("Approved visual preview hash does not match the recorded approval");
    } catch {
      errors.push(`Approved visual preview does not exist: ${approval.approvedPreview}`);
    }
  }

  return {
    mode,
    status: errors.length ? "pending" : "approved",
    approval,
    errors,
  };
}

export function resolvePreviewPath(taskDir, value) {
  return safePreviewPath(path.resolve(taskDir), value);
}

export async function isInsidePreviewRoot(taskDir, file) {
  const [previewRoot, actualFile] = await Promise.all([
    realpath(path.resolve(taskDir, "previews")),
    realpath(file),
  ]);
  return actualFile.startsWith(`${previewRoot}${path.sep}`);
}

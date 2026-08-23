import { access, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateTypographyPlan } from "./typography-plan.mjs";
import { validateVisualDirection } from "./visual-direction.mjs";

export const VISUAL_PLAN_HEADERS = [
  "ID",
  "视觉元素/位置",
  "作用",
  "构图关键",
  "身份关键",
  "处理方式",
  "来源/动作",
  "透明要求",
  "最终引用",
  "状态",
];

export const VISUAL_METHODS = new Set([
  "user-original",
  "project-asset",
  "first-party",
  "image-generation",
  "mingcute-svg",
  "inline-svg",
  "html-css",
  "device-native",
]);

export const VISUAL_STATUSES = new Set(["planned", "resolving", "ready", "blocked"]);
const FILE_METHODS = new Set(["user-original", "project-asset", "first-party", "image-generation"]);
const IDENTITY_METHODS = new Set(["user-original", "project-asset", "first-party"]);

function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function isPlaceholder(value) {
  return !value
    || /<[^>]+>|\{\{[^}]+\}\}|\b(?:todo|tbd)\b/i.test(value)
    || value === "-";
}

function extractSection(markdown) {
  const heading = /^## Visual Asset Plan\s*$/m.exec(markdown);
  if (!heading) return null;
  const start = heading.index + heading[0].length;
  const remainder = markdown.slice(start);
  const nextHeading = /^##\s+/m.exec(remainder);
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
}

export function parseVisualPlan(markdown) {
  const errors = [];
  const section = extractSection(markdown);
  if (!section) return { inventoryResult: null, mingcuteVersion: null, assets: [], errors: ["Missing ## Visual Asset Plan section"] };

  const inventoryMatch = /^- Inventory result:\s*(\S+)\s*$/mi.exec(section);
  const inventoryResult = inventoryMatch?.[1] || null;
  if (!new Set(["populated", "none"]).has(inventoryResult)) {
    errors.push("Inventory result must be populated or none");
  }

  const versionMatch = /^- MingCute package version:\s*(\S+)\s*$/mi.exec(section);
  const mingcuteVersion = versionMatch?.[1] || null;
  if (!/^\d+\.\d+\.\d+$/.test(mingcuteVersion || "")) {
    errors.push("MingCute package version must be an exact semantic version");
  }

  const lines = section.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => tableCells(line)?.[0] === "ID");
  if (headerIndex < 0) {
    errors.push("Missing visual asset plan table");
    return { inventoryResult, mingcuteVersion, assets: [], errors };
  }

  const headers = tableCells(lines[headerIndex]);
  if (headers.length !== VISUAL_PLAN_HEADERS.length
    || headers.some((header, index) => header !== VISUAL_PLAN_HEADERS[index])) {
    errors.push(`Visual asset plan headers must be: ${VISUAL_PLAN_HEADERS.join(" | ")}`);
  }

  const separator = tableCells(lines[headerIndex + 1] || "");
  if (!separator || separator.length !== VISUAL_PLAN_HEADERS.length
    || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    errors.push("Visual asset plan table needs a valid Markdown separator row");
  }

  const assets = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = tableCells(lines[index]);
    if (!cells) break;
    if (cells.length !== VISUAL_PLAN_HEADERS.length) {
      errors.push(`Visual asset row ${index + 1} must contain ${VISUAL_PLAN_HEADERS.length} columns`);
      continue;
    }
    assets.push({
      id: cells[0],
      visual: cells[1],
      role: cells[2],
      compositionCritical: cells[3],
      identityCritical: cells[4],
      method: cells[5],
      sourceAction: cells[6],
      transparency: cells[7],
      finalReference: cells[8],
      status: cells[9],
      line: index + 1,
    });
  }

  return { inventoryResult, mingcuteVersion, assets, errors };
}

export async function validateDesign(file) {
  const designPath = path.resolve(file);
  const markdown = await readFile(designPath, "utf8");
  const parsed = parseVisualPlan(markdown);
  const typography = await validateTypographyPlan(markdown);
  const visualDirection = await validateVisualDirection(designPath, markdown);
  const errors = [...parsed.errors, ...typography.errors, ...visualDirection.errors];
  const device = /^- Device:\s*(web|mobile)\s*$/mi.exec(markdown)?.[1] || null;
  if (!device) errors.push("Design canvas must declare Device: web or mobile");

  if (parsed.inventoryResult === "none") {
    if (parsed.assets.length) errors.push("Inventory result none requires an empty visual asset table");
    if (device === "mobile") errors.push("Mobile designs must inventory device-native system visuals");
  }
  if (parsed.inventoryResult === "populated" && !parsed.assets.length) {
    errors.push("Inventory result populated requires at least one visual asset row");
  }

  const ids = new Set();
  for (const asset of parsed.assets) {
    const prefix = `Visual asset ${asset.id || `(line ${asset.line})`}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id)) errors.push(`${prefix} needs a unique kebab-case ID`);
    if (ids.has(asset.id)) errors.push(`${prefix} uses a duplicate ID`);
    ids.add(asset.id);

    for (const [field, value] of [["visual/location", asset.visual], ["role", asset.role], ["source/action", asset.sourceAction], ["final reference", asset.finalReference]]) {
      if (isPlaceholder(value)) errors.push(`${prefix} has an empty or placeholder ${field}`);
    }
    if (!new Set(["yes", "no"]).has(asset.compositionCritical)) errors.push(`${prefix} composition critical must be yes or no`);
    if (!new Set(["yes", "no"]).has(asset.identityCritical)) errors.push(`${prefix} identity critical must be yes or no`);
    if (!VISUAL_METHODS.has(asset.method)) errors.push(`${prefix} has unsupported method: ${asset.method}`);
    if (!new Set(["yes", "no", "n/a"]).has(asset.transparency)) errors.push(`${prefix} transparency must be yes, no, or n/a`);
    if (!VISUAL_STATUSES.has(asset.status)) errors.push(`${prefix} has unsupported status: ${asset.status}`);
    else if (asset.status !== "ready") errors.push(`${prefix} is ${asset.status}; every visual asset must be ready before HTML initialization`);

    if (asset.identityCritical === "yes" && !IDENTITY_METHODS.has(asset.method)) {
      errors.push(`${prefix} is identity-critical and must use a user, project, or first-party original`);
    }

    if (FILE_METHODS.has(asset.method) && !isPlaceholder(asset.finalReference)) {
      if (path.isAbsolute(asset.finalReference)) {
        errors.push(`${prefix} final reference must be relative to the task directory`);
      } else if (!asset.finalReference.replaceAll("\\", "/").startsWith("assets/final/")) {
        errors.push(`${prefix} final asset must be stored under assets/final/`);
      } else {
        const resolved = path.resolve(path.dirname(designPath), asset.finalReference);
        const taskPrefix = `${path.dirname(designPath)}${path.sep}`;
        if (!resolved.startsWith(taskPrefix)) errors.push(`${prefix} final reference escapes the task directory`);
        else {
          try {
            const finalStat = await stat(resolved);
            if (!finalStat.isFile()) errors.push(`${prefix} final asset is not a file: ${asset.finalReference}`);
          } catch {
            errors.push(`${prefix} final asset does not exist: ${asset.finalReference}`);
          }
        }
      }
    }

    if (asset.method === "mingcute-svg" && !isPlaceholder(asset.finalReference)) {
      const match = /^name=([a-z0-9]+(?:-[a-z0-9]+)*);\s*style=(regular|filled);\s*version=(\d+\.\d+\.\d+)$/.exec(asset.finalReference);
      if (!match) errors.push(`${prefix} MingCute reference must use name=<name>; style=<regular|filled>; version=<x.y.z>`);
      else {
        if (match[3] !== parsed.mingcuteVersion) errors.push(`${prefix} MingCute version must match the plan version ${parsed.mingcuteVersion}`);
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const iconPath = path.resolve(moduleDir, "..", "..", "node_modules", "@mingcute", "svg", `core-${match[2]}`, `${match[1]}.svg`);
        try {
          await access(iconPath);
        } catch {
          errors.push(`${prefix} MingCute icon does not exist locally: ${match[2]}/${match[1]}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    file: designPath,
    device,
    inventoryResult: parsed.inventoryResult,
    mingcuteVersion: parsed.mingcuteVersion,
    assets: parsed.assets,
    typography,
    visualDirection,
    errors,
  };
}

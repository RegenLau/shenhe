import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const TYPOGRAPHY_PLAN_HEADERS = [
  "ID",
  "用途/位置",
  "参考字体",
  "最终本地字体",
  "字符覆盖",
  "字重",
  "替代说明",
  "CSS 变量",
  "状态",
];

export const UI_FONT_PREFERENCE = [
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  "Source Han Sans SC",
];

export const UI_FONT_WEIGHTS = [300, 400, 500, 600];
const DISPLAY_STATUSES = new Set(["planned", "resolving", "ready", "blocked"]);
const CHARACTER_COVERAGE = new Set(["cjk", "latin", "mixed"]);

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

function section(markdown) {
  const heading = /^## Typography Plan\s*$/m.exec(markdown);
  if (!heading) return null;
  const start = heading.index + heading[0].length;
  const remainder = markdown.slice(start);
  const nextHeading = /^##\s+/m.exec(remainder);
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
}

function field(source, label) {
  const match = new RegExp(`^- ${label}:\\s*(.+?)\\s*$`, "mi").exec(source);
  return match?.[1]?.trim() || null;
}

export function parseCssFamilyList(value) {
  const families = [];
  let current = "";
  let quote = null;
  for (const character of value || "") {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ",") {
      families.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) families.push(current.trim());
  return families.map((family) => family.replace(/^(["'])(.*)\1$/, "$2").trim());
}

function parseWeights(value) {
  if (!value) return [];
  return value.split(",").map((weight) => Number(weight.trim()));
}

function cleanFamilies(stdout, platform) {
  const families = new Set();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const candidates = platform === "linux" ? line.split(",") : [line];
    for (const candidate of candidates) {
      const family = candidate.trim();
      if (family) families.add(family);
    }
  }
  return [...families].sort((a, b) => a.localeCompare(b, "en"));
}

let localFontPromise;

export async function listLocalFontFamilies() {
  if (localFontPromise) return localFontPromise;
  localFontPromise = (async () => {
    let command;
    let args;
    if (process.platform === "darwin") {
      command = "atsutil";
      args = ["fonts", "-list"];
    } else if (process.platform === "linux") {
      command = "fc-list";
      args = ["--format=%{family}\\n"];
    } else if (process.platform === "win32") {
      command = "powershell.exe";
      args = [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families.Name",
      ];
    } else {
      throw new Error(`Unsupported platform for local font enumeration: ${process.platform}`);
    }
    try {
      const { stdout } = await execFileAsync(command, args, { maxBuffer: 16 * 1024 * 1024 });
      const families = cleanFamilies(stdout, process.platform);
      if (!families.length) throw new Error("font command returned no families");
      return families;
    } catch (error) {
      throw new Error(`Unable to enumerate installed local fonts: ${error.message}`);
    }
  })();
  return localFontPromise;
}

export function parseTypographyPlan(markdown) {
  const errors = [];
  const content = section(markdown);
  if (!content) {
    return {
      preferredUiFont: null,
      resolvedUiFont: null,
      uiFontStack: null,
      uiWeights: [],
      displayInventory: null,
      displayFonts: [],
      errors: ["Missing ## Typography Plan section"],
    };
  }

  const preferredUiFont = field(content, "Preferred UI font");
  const resolvedUiFont = field(content, "Resolved UI font");
  const uiFontStack = field(content, "UI font stack");
  const uiWeights = parseWeights(field(content, "UI weights"));
  const displayInventory = field(content, "Display font inventory");
  if (!new Set(["populated", "none"]).has(displayInventory)) {
    errors.push("Display font inventory must be populated or none");
  }

  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => tableCells(line)?.[0] === "ID");
  if (headerIndex < 0) {
    errors.push("Missing typography plan table");
    return { preferredUiFont, resolvedUiFont, uiFontStack, uiWeights, displayInventory, displayFonts: [], errors };
  }

  const headers = tableCells(lines[headerIndex]);
  if (headers.length !== TYPOGRAPHY_PLAN_HEADERS.length
    || headers.some((header, index) => header !== TYPOGRAPHY_PLAN_HEADERS[index])) {
    errors.push(`Typography plan headers must be: ${TYPOGRAPHY_PLAN_HEADERS.join(" | ")}`);
  }

  const separator = tableCells(lines[headerIndex + 1] || "");
  if (!separator || separator.length !== TYPOGRAPHY_PLAN_HEADERS.length
    || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    errors.push("Typography plan table needs a valid Markdown separator row");
  }

  const displayFonts = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = tableCells(lines[index]);
    if (!cells) break;
    if (cells.length !== TYPOGRAPHY_PLAN_HEADERS.length) {
      errors.push(`Typography row ${index + 1} must contain ${TYPOGRAPHY_PLAN_HEADERS.length} columns`);
      continue;
    }
    displayFonts.push({
      id: cells[0],
      usage: cells[1],
      requestedFamily: cells[2],
      resolvedFamily: cells[3],
      characterCoverage: cells[4],
      weights: parseWeights(cells[5]),
      substitutionReason: cells[6],
      cssVariable: cells[7],
      status: cells[8],
      line: index + 1,
    });
  }

  return {
    preferredUiFont,
    resolvedUiFont,
    uiFontStack,
    uiWeights,
    displayInventory,
    displayFonts,
    errors,
  };
}

export async function validateTypographyPlan(markdown) {
  const parsed = parseTypographyPlan(markdown);
  const errors = [...parsed.errors];
  const required = [
    ["Preferred UI font", parsed.preferredUiFont],
    ["Resolved UI font", parsed.resolvedUiFont],
    ["UI font stack", parsed.uiFontStack],
  ];
  for (const [label, value] of required) {
    if (isPlaceholder(value)) errors.push(`${label} must be resolved`);
  }

  if (parsed.preferredUiFont !== "PingFang SC") {
    errors.push("Preferred UI font must be PingFang SC");
  }
  if (parsed.uiWeights.length !== UI_FONT_WEIGHTS.length
    || parsed.uiWeights.some((weight, index) => weight !== UI_FONT_WEIGHTS[index])) {
    errors.push(`UI weights must be exactly: ${UI_FONT_WEIGHTS.join(", ")}`);
  }

  const stack = parseCssFamilyList(parsed.uiFontStack);
  if (stack[0] !== parsed.resolvedUiFont) errors.push("UI font stack must begin with the resolved UI font");
  if (stack.at(-1)?.toLowerCase() !== "sans-serif") errors.push("UI font stack must end with sans-serif");
  if (stack.some((family) => /(?:https?:|url\(|@font-face)/i.test(family))) {
    errors.push("UI font stack must contain local family names only");
  }

  let localFamilies = [];
  try {
    localFamilies = await listLocalFontFamilies();
  } catch (error) {
    errors.push(error.message);
  }
  const localLookup = new Map(localFamilies.map((family) => [family.toLowerCase(), family]));
  const firstInstalledUiFont = UI_FONT_PREFERENCE.find((family) => localLookup.has(family.toLowerCase()));
  if (!firstInstalledUiFont) errors.push(`No supported UI font is installed: ${UI_FONT_PREFERENCE.join(", ")}`);
  else if (parsed.resolvedUiFont !== firstInstalledUiFont) {
    errors.push(`Resolved UI font must be the first installed preference: ${firstInstalledUiFont}`);
  }
  if (parsed.resolvedUiFont && !localLookup.has(parsed.resolvedUiFont.toLowerCase())) {
    errors.push(`Resolved UI font is not installed locally: ${parsed.resolvedUiFont}`);
  }

  const resolvedIndex = UI_FONT_PREFERENCE.indexOf(parsed.resolvedUiFont);
  if (resolvedIndex >= 0) {
    const expectedStack = [...UI_FONT_PREFERENCE.slice(resolvedIndex), "sans-serif"];
    if (stack.length !== expectedStack.length || stack.some((family, index) => family !== expectedStack[index])) {
      errors.push(`UI font stack must be: ${expectedStack.map((family) => family === "sans-serif" ? family : `"${family}"`).join(", ")}`);
    }
  }

  if (parsed.displayInventory === "none" && parsed.displayFonts.length) {
    errors.push("Display font inventory none requires an empty typography table");
  }
  if (parsed.displayInventory === "populated" && !parsed.displayFonts.length) {
    errors.push("Display font inventory populated requires at least one typography row");
  }

  const ids = new Set();
  const variables = new Set();
  for (const font of parsed.displayFonts) {
    const prefix = `Display font ${font.id || `(line ${font.line})`}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(font.id)) errors.push(`${prefix} needs a unique kebab-case ID`);
    if (ids.has(font.id)) errors.push(`${prefix} uses a duplicate ID`);
    ids.add(font.id);

    for (const [label, value] of [
      ["usage/location", font.usage],
      ["requested family", font.requestedFamily],
      ["resolved local family", font.resolvedFamily],
      ["substitution reason", font.substitutionReason],
      ["CSS variable", font.cssVariable],
    ]) {
      if (isPlaceholder(value)) errors.push(`${prefix} has an empty or placeholder ${label}`);
    }
    if (!CHARACTER_COVERAGE.has(font.characterCoverage)) {
      errors.push(`${prefix} character coverage must be cjk, latin, or mixed`);
    }
    if (!font.weights.length || font.weights.some((weight) => !Number.isInteger(weight) || weight < 100 || weight > 900)) {
      errors.push(`${prefix} weights must be comma-separated numeric values from 100 to 900`);
    }
    if (!/^--font-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(font.cssVariable)) {
      errors.push(`${prefix} CSS variable must match --font-<name>`);
    }
    if (font.cssVariable === "--font-ui") errors.push(`${prefix} cannot reuse --font-ui`);
    if (variables.has(font.cssVariable)) errors.push(`${prefix} uses a duplicate CSS variable`);
    variables.add(font.cssVariable);
    if (!DISPLAY_STATUSES.has(font.status)) errors.push(`${prefix} has unsupported status: ${font.status}`);
    else if (font.status !== "ready") errors.push(`${prefix} is ${font.status}; every display font must be ready before HTML initialization`);

    if (font.resolvedFamily && !localLookup.has(font.resolvedFamily.toLowerCase())) {
      errors.push(`${prefix} is not installed locally: ${font.resolvedFamily}`);
    }
    const exactMatch = font.requestedFamily?.toLowerCase() === font.resolvedFamily?.toLowerCase();
    if (exactMatch && font.substitutionReason !== "exact-local-match") {
      errors.push(`${prefix} exact family matches must use substitution reason exact-local-match`);
    }
    if (!exactMatch && font.substitutionReason === "exact-local-match") {
      errors.push(`${prefix} substituted families need a concrete substitution reason`);
    }
  }

  return {
    valid: errors.length === 0,
    ...parsed,
    requiredLocalFonts: [parsed.resolvedUiFont, ...parsed.displayFonts.map((font) => font.resolvedFamily)].filter(Boolean),
    errors,
  };
}

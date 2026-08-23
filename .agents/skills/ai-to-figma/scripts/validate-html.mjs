#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { validateDesign } from "./lib/visual-plan.mjs";
import { parseCssFamilyList } from "./lib/typography-plan.mjs";

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    if (arg === "--json") {
      values.json = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values[arg.slice(2)] = value;
    i += 1;
  }
  return values;
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rootAttribute(html, name) {
  const root = /<[^>]+\bdata-figma-capture-root\b[^>]*>/i.exec(html)?.[0] || "";
  return new RegExp(`\\b${escapeRegExp(name)}=["']([^"']*)["']`, "i").exec(root)?.[1] || null;
}

function fontVariableDeclarations(html) {
  const declarations = new Map();
  for (const match of html.matchAll(/(--font-[a-z0-9-]+)\s*:\s*([^;{}]+);/gi)) {
    declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

function sameFamilies(actual, expected) {
  const actualFamilies = parseCssFamilyList(actual);
  const expectedFamilies = parseCssFamilyList(expected);
  return actualFamilies.length === expectedFamilies.length
    && actualFamilies.every((family, index) => family === expectedFamilies[index]);
}

function hasDimension(html, property, pixels) {
  const direct = new RegExp(`${property}\\s*:\\s*${pixels}px`, "i");
  const variable = new RegExp(`--canvas-${property.replace("min-", "min-")}\\s*:\\s*${pixels}px`, "i");
  return direct.test(html) || variable.test(html);
}

function iconDependencyErrors(html) {
  const errors = [];
  const unresolved = [
    /<!--\s*mingcute:(?:regular|filled):[a-z0-9-]+\s*-->/i,
    /\{\{\s*MINGCUTE(?:_ICON)?[^}]*\}\}/i,
    /\bdata-mingcute-(?:icon-)?slot\b/i,
  ];
  if (unresolved.some((expression) => expression.test(html))) {
    errors.push("Unresolved MingCute icon placeholder detected; inline it before capture");
  }

  if (/@mingcute\/(?:react|vue|react-native|svelte|solid|vanilla|web-components|font|svg|icons)\b/i.test(html)) {
    errors.push("MingCute package imports are authoring-only; final HTML must contain inline SVG");
  }
  if (/<[A-Z][A-Za-z0-9]*(?:Regular|Filled|Icon)\b/.test(html)) {
    errors.push("Framework icon component detected; final HTML must contain inline SVG");
  }
  if (/<i\b[^>]*\bclass=["'][^"']*\b(?:mgc|iconfont|material-icons|fa[srlbd]?)\b/i.test(html)
    || /@font-face[\s\S]*?(?:mingcute|iconfont|fontawesome|material[ -]?icons)/i.test(html)) {
    errors.push("Icon font detected; use MingCute inline SVG");
  }
  if (/<(?:script|link)\b[^>]*(?:src|href)=["'][^"']*(?:mingcute|lucide|heroicons?|font-?awesome|iconify|material-icons|remixicon|bootstrap-icons|phosphor|tabler-icons?)[^"']*["']/i.test(html)
    || /<svg\b[^>]*\bclass=["'][^"']*\b(?:lucide|heroicon|iconify|phosphor|tabler)\b/i.test(html)) {
    errors.push("External or mixed generic icon library detected; use MingCute Core only");
  }
  if (/<use\b/i.test(html)) errors.push("SVG sprites are not allowed; inline each complete MingCute SVG");
  if (/<(?:image|feImage)\b[^>]*\b(?:href|xlink:href)=["'](?!data:|#)[^"']+["']/i.test(html)
    || /<(?:object|embed)\b[^>]*(?:data|src)=["'][^"']+\.svg(?:[?#][^"']*)?["']/i.test(html)) {
    errors.push("External SVG dependency detected; inline self-contained SVG content");
  }
  return errors;
}

async function localAssetErrors(html, htmlPath) {
  const errors = [];
  const directory = path.dirname(htmlPath);
  const regex = /<(?:img|source)\b[^>]*\b(?:src|srcset)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    for (const candidate of match[1].split(",").map((part) => part.trim().split(/\s+/)[0])) {
      if (!candidate || /^(?:data:|https?:|#)/i.test(candidate)) continue;
      const clean = candidate.split(/[?#]/)[0];
      try {
        await access(path.resolve(directory, clean));
      } catch {
        errors.push(`Missing local asset: ${candidate}`);
      }
    }
  }
  return errors;
}

function visualElements(html) {
  const elements = [];
  const tagPattern = /<([a-z][a-z0-9:-]*)\b([^>]*)>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const idMatch = /\bdata-visual-id\s*=\s*["']([^"']+)["']/i.exec(match[2]);
    if (idMatch) elements.push({ id: idMatch[1], tag: match[1].toLowerCase(), attributes: match[2] });
  }
  return elements;
}

function visualPlanErrors(html, design) {
  const errors = [];
  if (!design.valid) {
    return design.errors.map((error) => `Design plan gate is not ready: ${error}`);
  }

  const elements = visualElements(html);
  const declared = new Map(design.assets.map((asset) => [asset.id, asset]));
  const implemented = new Set(elements.map((element) => element.id));
  for (const id of declared.keys()) {
    if (!implemented.has(id)) errors.push(`Missing data-visual-id in HTML: ${id}`);
  }
  for (const id of implemented) {
    if (!declared.has(id)) errors.push(`Undeclared data-visual-id in HTML: ${id}`);
  }

  const fileMethods = new Set(["user-original", "project-asset", "first-party", "image-generation"]);
  for (const [id, asset] of declared) {
    const matches = elements.filter((element) => element.id === id);
    if (fileMethods.has(asset.method)) {
      const hasExpectedMedia = matches.some((element) => {
        if (!new Set(["img", "source"]).has(element.tag)) return false;
        const source = /\b(?:src|srcset)\s*=\s*["']([^"']+)["']/i.exec(element.attributes)?.[1] || "";
        return source.split(",").some((candidate) => candidate.trim().split(/\s+/)[0].split(/[?#]/)[0] === asset.finalReference);
      });
      if (!hasExpectedMedia) errors.push(`Visual asset ${id} must use ${asset.finalReference} on an img or source element`);
    }
    if (new Set(["mingcute-svg", "inline-svg"]).has(asset.method)
      && !matches.some((element) => element.tag === "svg")) {
      errors.push(`Visual asset ${id} must be implemented as inline SVG`);
    }
  }
  return errors;
}

function typographyPlanErrors(html, typography) {
  const errors = [];
  const declarations = fontVariableDeclarations(html);
  const allowedVariables = new Set(["--font-ui", ...typography.displayFonts.map((font) => font.cssVariable)]);

  if (/@font-face\b/i.test(html)) errors.push("@font-face is not allowed; use installed local fonts only");
  if (!/font-synthesis\s*:\s*none\s*;/i.test(html)) errors.push("font-synthesis: none is required");

  const uiDeclaration = declarations.get("--font-ui");
  if (!uiDeclaration) errors.push("Missing --font-ui declaration");
  else if (!sameFamilies(uiDeclaration, typography.uiFontStack)) {
    errors.push("--font-ui must match the UI font stack in design.md");
  }

  for (const variable of declarations.keys()) {
    if (!allowedVariables.has(variable)) errors.push(`Undeclared typography variable in HTML: ${variable}`);
  }

  for (const font of typography.displayFonts) {
    const declaration = declarations.get(font.cssVariable);
    if (!declaration) {
      errors.push(`Missing display font variable in HTML: ${font.cssVariable}`);
      continue;
    }
    const families = parseCssFamilyList(declaration);
    if (families[0] !== font.resolvedFamily) {
      errors.push(`${font.cssVariable} must begin with resolved local family ${font.resolvedFamily}`);
    }
    if (families.at(-1) !== "var(--font-ui)") {
      errors.push(`${font.cssVariable} must end with var(--font-ui)`);
    }
  }

  for (const match of html.matchAll(/font-family\s*:\s*([^;{}]+);/gi)) {
    const value = match[1].trim();
    const variable = /^var\((--font-[a-z0-9-]+)\)$/.exec(value)?.[1];
    if (!variable || !allowedVariables.has(variable)) {
      errors.push(`font-family must use a declared typography variable: ${value}`);
    }
  }
  if (/(?:^|[;{]\s*)font\s*:/im.test(html)) {
    errors.push("CSS font shorthand is not allowed; use explicit typography properties");
  }

  for (const font of typography.displayFonts) {
    const usePattern = new RegExp(`font-family\\s*:\\s*var\\(${escapeRegExp(font.cssVariable)}\\)\\s*;`, "i");
    if (!usePattern.test(html)) errors.push(`Display font variable is declared but unused: ${font.cssVariable}`);
  }

  const allowedWeights = new Set([
    ...typography.uiWeights,
    ...typography.displayFonts.flatMap((font) => font.weights),
  ]);
  for (const match of html.matchAll(/font-weight\s*:\s*([^;{}]+);/gi)) {
    const value = match[1].trim();
    const weight = Number(value);
    if (!Number.isInteger(weight) || !allowedWeights.has(weight)) {
      errors.push(`Font weight is not declared in the Typography Plan: ${value}`);
    }
  }

  const uiFont = rootAttribute(html, "data-ui-font");
  if (uiFont !== typography.resolvedUiFont) errors.push("data-ui-font must match the resolved UI font in design.md");
  const requiredFonts = (rootAttribute(html, "data-required-local-fonts") || "")
    .split("|")
    .map((family) => family.trim())
    .filter(Boolean);
  const expectedFonts = [...new Set(typography.requiredLocalFonts)];
  if (requiredFonts.length !== expectedFonts.length
    || expectedFonts.some((family) => !requiredFonts.includes(family))) {
    errors.push("data-required-local-fonts must list every resolved local family exactly once");
  }

  if (!/getComputedStyle\(captureRoot\)\.fontFamily/i.test(html)) errors.push("No computed UI font capture check found");
  if (!/window\.captureReady\s*=\s*Promise\.all/i.test(html)) errors.push("No window.captureReady gate found");
  return errors;
}

async function validate(file, device, designPath) {
  const htmlPath = path.resolve(file);
  const html = await readFile(htmlPath, "utf8");
  const design = await validateDesign(path.resolve(designPath));
  const errors = [];
  const warnings = [];

  if (/["'](?:\.\/)?previews\//i.test(html)) {
    errors.push("Approved visual preview cannot be used in final HTML; rebuild the design with editable HTML and separate assets");
  }

  const rootCount = countMatches(html, /\bdata-figma-capture-root(?:\s|=|>)/gi);
  if (rootCount !== 1) errors.push(`Expected exactly one data-figma-capture-root, found ${rootCount}`);

  if (/<script\b[^>]*\bsrc=["']https?:/i.test(html)) errors.push("Remote script dependency is not allowed");
  if (/<link\b[^>]*\bhref=["']https?:/i.test(html)) errors.push("Remote stylesheet or font dependency is not allowed");
  if (/<(?:img|source)\b[^>]*\b(?:src|srcset)=["']https?:/i.test(html)) errors.push("Remote image dependency is not allowed; localize assets first");
  if (/\b(?:react|vue|angular)(?:\.production)?(?:\.min)?\.js\b/i.test(html)) errors.push("Framework runtime detected; use static HTML and native JavaScript");
  errors.push(...iconDependencyErrors(html));

  if (!/\.capture-root\s*\{[\s\S]*?background(?:-color)?\s*:\s*(?!transparent\b)[^;]+;/i.test(html)) {
    errors.push("Capture root needs an explicit opaque background declaration");
  }

  if (device === "web") {
    if (!hasDimension(html, "width", 1440)) errors.push("Web canvas must declare width: 1440px");
    if (!hasDimension(html, "min-height", 900)) errors.push("Web canvas must declare min-height: 900px");
  } else if (device === "mobile") {
    if (!hasDimension(html, "width", 375)) errors.push("Mobile canvas must declare width: 375px");
    if (!hasDimension(html, "min-height", 812)) errors.push("Mobile canvas must declare min-height: 812px");
    const required = [
      ["data-ios-status-bar", 1],
      ["data-ios-content", 1],
      ["data-ios-home-area", 1],
      ["data-ios-home-indicator", 1],
    ];
    for (const [attribute, expected] of required) {
      const count = countMatches(html, new RegExp(`\\b${attribute}(?:\\s|=|>)`, "gi"));
      if (count !== expected) errors.push(`Expected exactly ${expected} ${attribute}, found ${count}`);
    }
    if (!/--ios-status-height\s*:\s*44px/i.test(html)) errors.push("iOS status height must be 44px");
    if (!/--ios-content-min-height\s*:\s*734px/i.test(html)) errors.push("iOS content minimum height must be 734px");
    if (!/--ios-home-height\s*:\s*34px/i.test(html)) errors.push("iOS home area height must be 34px");
    if (!/\[data-ios-home-indicator\][\s\S]*?width\s*:\s*134px[\s\S]*?height\s*:\s*5px/i.test(html)) {
      errors.push("iOS home indicator must declare 134px × 5px");
    }
    if (/\[data-ios-(?:status-bar|home-area)\][\s\S]*?position\s*:\s*(?:fixed|sticky)/i.test(html)) {
      errors.push("iOS system chrome must not be fixed or sticky in a long capture");
    }
  } else {
    errors.push("Device must be web or mobile");
  }

  errors.push(...await localAssetErrors(html, htmlPath));
  errors.push(...visualPlanErrors(html, design));
  errors.push(...typographyPlanErrors(html, design.typography));
  if (!/document\.fonts\s*\?\s*document\.fonts\.ready|document\.fonts\.ready/i.test(html)) {
    warnings.push("No explicit document.fonts.ready capture gate found");
  }

  return { valid: errors.length === 0, file: htmlPath, device, errors, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("--file is required");
  if (!args.device) throw new Error("--device is required");
  if (!args.design) throw new Error("--design is required");
  const result = await validate(args.file, args.device, args.design);
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    for (const warning of result.warnings) process.stderr.write(`WARN: ${warning}\n`);
    process.stdout.write(result.valid ? "HTML validation passed\n" : "HTML validation failed\n");
  }
  if (!result.valid) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

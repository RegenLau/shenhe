#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(scriptDirectory, "..");
const templatePath = path.join(skillDirectory, "assets", "figma-target-chooser.html");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  if (!args.input || !args.output) throw new Error("Usage: render-target-chooser.mjs --input <state.json> --output <fragment.html>");
  return args;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isThreadVisualizationPath(candidate) {
  return candidate.includes(`${path.sep}.codex${path.sep}visualizations${path.sep}`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function normalizeState(raw) {
  const language = raw.language === "en" ? "en" : "zh";
  const account = {
    handle: typeof raw.account?.handle === "string" ? raw.account.handle.trim() : "",
    email: typeof raw.account?.email === "string" ? raw.account.email.trim() : ""
  };
  if (!account.handle && !account.email) throw new Error("State must include account.handle or account.email from Figma whoami");

  const plans = Array.isArray(raw.plans) ? raw.plans.map((plan, index) => ({
    key: typeof plan?.key === "string" ? plan.key.trim() : "",
    name: typeof plan?.name === "string" ? plan.name.trim() : "",
    seat: typeof plan?.seat === "string" ? plan.seat.trim() : "",
    tier: typeof plan?.tier === "string" ? plan.tier.trim() : "",
    index
  })) : [];
  for (const plan of plans) {
    if (!plan.key || !plan.name) throw new Error(`Plan at index ${plan.index} must include non-empty key and name`);
  }
  if (new Set(plans.map((plan) => plan.key)).size !== plans.length) throw new Error("Plan keys must be unique");

  const knownMode = raw.known?.destinationMode ?? null;
  if (![null, "existing", "new"].includes(knownMode)) throw new Error("known.destinationMode must be existing, new, or null");
  const targetUrl = typeof raw.known?.targetUrl === "string" ? raw.known.targetUrl.trim() : "";
  return { language, account, plans: plans.map(({ index, ...plan }) => plan), knownMode, targetUrl };
}

const labels = {
  zh: {
    account: "当前 Figma 登录身份",
    accountFallback: "当前账号",
    chooseDestination: "做好的文件放哪里？",
    existing: "放进现有 Figma Design 文件",
    existingHelp: "填写目标文件链接",
    create: "新建 Figma Design 文件",
    createHelp: "选择团队或组织，文件将进入该计划的 Drafts",
    targetUrl: "Figma Design 链接",
    targetPlaceholder: "https://www.figma.com/design/...",
    choosePlan: "选择团队或组织",
    noPlans: "当前账号没有可用于新建文件的团队或组织。",
    invalidUrl: "请输入有效的 Figma Design 链接；不支持 FigJam、Slides、Make 或项目文件夹链接。",
    submit: "确认交付位置",
    wrongAccount: "当前账号不对，先切换连接",
    confirmTitle: "使用这个 Figma 交付位置",
    switchTitle: "切换 Figma 账号"
  },
  en: {
    account: "Current Figma identity",
    accountFallback: "Current account",
    chooseDestination: "Where should the finished file go?",
    existing: "Use an existing Figma Design file",
    existingHelp: "Enter the destination file URL",
    create: "Create a new Figma Design file",
    createHelp: "Choose a team or organization; the file will be created in that plan's Drafts",
    targetUrl: "Figma Design URL",
    targetPlaceholder: "https://www.figma.com/design/...",
    choosePlan: "Choose a team or organization",
    noPlans: "The current account has no team or organization available for file creation.",
    invalidUrl: "Enter a valid Figma Design URL. FigJam, Slides, Make, and project-folder URLs are not supported.",
    submit: "Confirm delivery target",
    wrongAccount: "This is the wrong account — switch connection",
    confirmTitle: "Use this Figma delivery target",
    switchTitle: "Switch Figma account"
  }
};

function modeSection(state, copy) {
  if (state.knownMode) return "";
  const createDisabled = state.plans.length === 0 ? " disabled" : "";
  return `<section class="card">\n    <h3>${escapeHtml(copy.chooseDestination)}</h3>\n    <div class="viz-grid">\n      <label class="form-check" for="target-mode-existing"><input class="form-check-input" id="target-mode-existing" name="destination_mode" type="radio" value="existing"><span class="form-check-label"><strong>${escapeHtml(copy.existing)}</strong><br><span class="text-small">${escapeHtml(copy.existingHelp)}</span></span></label>\n      <label class="form-check" for="target-mode-new"><input class="form-check-input" id="target-mode-new" name="destination_mode" type="radio" value="new"${createDisabled}><span class="form-check-label"><strong>${escapeHtml(copy.create)}</strong><br><span class="text-small">${escapeHtml(copy.createHelp)}</span></span></label>\n    </div>\n  </section>`;
}

function existingSection(state, copy) {
  if (state.knownMode === "new") return "";
  const hidden = state.knownMode === "existing" ? "" : " hidden";
  return `<section class="card" id="target-gate-existing"${hidden}>\n    <label class="form-label" for="target-gate-url">${escapeHtml(copy.targetUrl)}</label>\n    <input class="form-control" id="target-gate-url" type="url" inputmode="url" autocomplete="off" placeholder="${escapeHtml(copy.targetPlaceholder)}" value="${escapeHtml(state.targetUrl)}">\n  </section>`;
}

function newSection(state, copy) {
  if (state.knownMode === "existing") return "";
  const hidden = state.knownMode === "new" ? "" : " hidden";
  const options = state.plans.length > 0
    ? state.plans.map((plan, index) => {
      const details = [plan.seat, plan.tier].filter(Boolean).join(" · ");
      const secondary = details ? `<br><span class="text-small">${escapeHtml(details)}</span>` : "";
      return `      <label class="form-check" for="target-plan-${index}"><input class="form-check-input" id="target-plan-${index}" name="plan_key" type="radio" value="${escapeHtml(plan.key)}"><span class="form-check-label"><strong>${escapeHtml(plan.name)}</strong>${secondary}</span></label>`;
    }).join("\n")
    : "";
  return `<section class="card" id="target-gate-new"${hidden}>\n    <h3>${escapeHtml(copy.choosePlan)}</h3>\n    <div class="viz-grid">\n${options}\n    </div>\n  </section>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  if (!isThreadVisualizationPath(inputPath) || !isThreadVisualizationPath(outputPath)) {
    throw new Error("Input and output must stay in a thread-scoped .codex/visualizations directory");
  }
  if (isInside(skillDirectory, inputPath) || isInside(skillDirectory, outputPath)) {
    throw new Error("Account and plan state must stay outside the distributable Skill directory");
  }
  if (path.extname(outputPath).toLowerCase() !== ".html") throw new Error("Output must be an .html fragment");

  const state = normalizeState(JSON.parse(await readFile(inputPath, "utf8")));
  const copy = labels[state.language];
  const template = await readFile(templatePath, "utf8");
  const accountName = state.account.handle || copy.accountFallback;
  const accountEmail = state.account.email ? `<p class="text-small">${escapeHtml(state.account.email)}</p>` : "";
  const config = {
    account: state.account,
    plans: state.plans,
    knownMode: state.knownMode,
    hasPlans: state.plans.length > 0,
    labels: {
      invalidUrl: copy.invalidUrl,
      noPlans: copy.noPlans,
      confirmTitle: copy.confirmTitle,
      switchTitle: copy.switchTitle
    }
  };
  const replacements = {
    "%%ACCOUNT_LABEL%%": escapeHtml(copy.account),
    "%%ACCOUNT_NAME%%": escapeHtml(accountName),
    "%%ACCOUNT_EMAIL%%": accountEmail,
    "%%MODE_SECTION%%": modeSection(state, copy),
    "%%EXISTING_SECTION%%": existingSection(state, copy),
    "%%NEW_SECTION%%": newSection(state, copy),
    "%%SUBMIT_LABEL%%": escapeHtml(copy.submit),
    "%%WRONG_ACCOUNT_LABEL%%": escapeHtml(copy.wrongAccount),
    "%%CONFIG_JSON%%": scriptJson(config)
  };
  const seen = new Set();
  const fragment = template.replace(/%%[A-Z_]+%%/g, (marker) => {
    if (!Object.hasOwn(replacements, marker)) throw new Error(`Unknown template marker: ${marker}`);
    seen.add(marker);
    return replacements[marker];
  });
  const missingMarkers = Object.keys(replacements).filter((marker) => !seen.has(marker));
  if (missingMarkers.length > 0) throw new Error(`Template is missing markers: ${missingMarkers.join(", ")}`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, fragment, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

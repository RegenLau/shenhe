#!/usr/bin/env node

import { validateDesign } from "./lib/visual-plan.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    if (arg === "--json") {
      values.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    values[arg.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("--file is required");
  const result = await validateDesign(args.file);
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    process.stdout.write(result.valid ? "Design plan validation passed\n" : "Design plan validation failed\n");
  }
  if (!result.valid) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

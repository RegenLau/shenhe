#!/usr/bin/env node

import { listLocalFontFamilies } from "./lib/typography-plan.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      values.json = true;
      continue;
    }
    if (arg !== "--query") throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for --query");
    values.query = value;
    index += 1;
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const query = args.query?.trim().toLowerCase();
  const families = (await listLocalFontFamilies())
    .filter((family) => !query || family.toLowerCase().includes(query));
  if (args.json) process.stdout.write(`${JSON.stringify({ query: args.query || null, families }, null, 2)}\n`);
  else process.stdout.write(families.length ? `${families.join("\n")}\n` : "No matching local fonts found\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

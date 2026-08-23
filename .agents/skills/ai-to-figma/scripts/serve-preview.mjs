#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const captureSelector = "[data-figma-capture-root]";
const captureScriptUrl = "https://mcp.figma.com/mcp/html-to-design/capture.js";
const allowedArgs = new Set([
  "dir",
  "port",
  "inject-file",
  "capture-id",
  "capture-endpoint",
  "capture-delay",
]);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (!allowedArgs.has(name)) throw new Error(`Unknown option: ${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    values[name] = value;
    i += 1;
  }
  return values;
}

function captureConfig(args, injection) {
  const captureFields = ["capture-id", "capture-endpoint", "capture-delay"];
  const captureRequested = captureFields.some((field) => args[field] !== undefined);
  if (!captureRequested) return null;
  if (!args["capture-id"]) throw new Error("--capture-id is required in capture mode");
  if (!args["capture-endpoint"]) throw new Error("--capture-endpoint is required in capture mode");
  if (!args["inject-file"]) throw new Error("--inject-file is required in capture mode");
  if (!injection.includes(captureScriptUrl)) {
    throw new Error(`Capture injection must include ${captureScriptUrl}`);
  }

  const captureId = args["capture-id"];
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(captureId)) {
    throw new Error("--capture-id must be a UUID");
  }

  let endpoint;
  try {
    endpoint = new URL(args["capture-endpoint"]);
  } catch {
    throw new Error("--capture-endpoint must be a valid URL");
  }
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "mcp.figma.com") {
    throw new Error("--capture-endpoint must use https://mcp.figma.com");
  }
  if (endpoint.pathname !== `/mcp/capture/${captureId}/submit`) {
    throw new Error("--capture-endpoint must contain the same capture ID as --capture-id");
  }

  const delay = Number(args["capture-delay"] ?? 1000);
  if (!Number.isInteger(delay) || delay < 0) {
    throw new Error("--capture-delay must be a non-negative integer");
  }
  return { captureId, endpoint: endpoint.toString(), delay };
}

function captureUrl(baseUrl, config) {
  const hash = new URLSearchParams({
    figmacapture: config.captureId,
    figmaendpoint: config.endpoint,
    figmadelay: String(config.delay),
    figmaselector: captureSelector,
  });
  return `${baseUrl}#${hash.toString()}`;
}

function safePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) throw new Error("--dir is required");
  const root = path.resolve(args.dir);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${root}`);

  const requestedPort = Number(args.port ?? 4173);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }
  const injection = args["inject-file"] ? await readFile(path.resolve(args["inject-file"]), "utf8") : "";
  const capture = captureConfig(args, injection);

  const server = http.createServer(async (request, response) => {
    try {
      const filePath = safePath(root, request.url || "/");
      if (!filePath) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      const extension = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes.get(extension) || "application/octet-stream";
      response.setHeader("Content-Type", contentType);
      response.setHeader("Cache-Control", "no-store");

      if (extension === ".html" && injection) {
        const html = await readFile(filePath, "utf8");
        if (!html.includes("</body>")) throw new Error(`Cannot inject capture snippet: ${filePath} has no </body>`);
        response.end(html.replace("</body>", `${injection}\n</body>`));
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch (error) {
      if (error.code === "ENOENT") response.writeHead(404).end("Not found");
      else response.writeHead(500).end(error.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  const url = `http://127.0.0.1:${port}/`;
  const result = { url, root, injected: Boolean(injection) };
  if (capture) {
    result.captureUrl = captureUrl(url, capture);
    result.captureSelector = captureSelector;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);

  const close = () => server.close(() => process.exit(0));
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

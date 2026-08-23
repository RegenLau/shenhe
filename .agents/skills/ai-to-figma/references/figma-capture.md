# Figma code-to-canvas capture

## Target resolution

Support only Figma Design URLs. Extract `fileKey` from `/design/<fileKey>/...` and convert a URL `node-id=1-2` to node ID `1:2`. Use a node only when the user explicitly designates it as the destination.

The delivery mode must already be resolved through `target-resolution.md` before local work begins. Immediately before the first Figma write, call `whoami` again. For an existing target, require metadata/page access under the current identity. For a new target, require the submitted account identity and plan key to remain present, load the available Figma create-file skill before `create_new_file`, create editor type `design` in that plan's Drafts, and reuse the returned file key. If identity, plan, or access changed, stop and rerun the delivery-target gate. Never store account identifiers, plan keys, or file keys in the repository.

## Pre-capture

Read the target’s top-level page list before capture. Confirm the local page is served from `127.0.0.1`, all assets return successfully, local validation passes, and the HTML contains exactly one `[data-figma-capture-root]`.

## Capture sequence

1. Call `generate_figma_design` with the target `fileKey` and optional destination `nodeId`, without a capture ID.
2. Save the exact returned capture snippet in a task-temporary file.
3. Run `serve-preview.mjs` with `--inject-file`, the returned `--capture-id`, the exact returned `--capture-endpoint`, and `--capture-delay 1000`. The server inserts the snippet into the HTTP response only and returns a `captureUrl` fixed to `[data-figma-capture-root]`.
4. Load that exact `captureUrl` in a JavaScript-capable browser. Do not open the plain preview URL, hand-build the hash, pass another selector, or capture `body`, `html`, or the viewport.
5. Poll `generate_figma_design` with the same `fileKey` and returned `captureId` every five seconds, at most ten times.
6. Stop when status is completed or failed.

The capture-server interface is:

```bash
node scripts/serve-preview.mjs \
  --dir .ai-to-figma/<slug> \
  --port 4173 \
  --inject-file .ai-to-figma/<slug>/capture-snippet.html \
  --capture-id <capture-id> \
  --capture-endpoint <capture-endpoint> \
  --capture-delay 1000
```

Capture mode requires the snippet, a UUID capture ID, and a matching `https://mcp.figma.com/mcp/capture/<capture-id>/submit...` endpoint. It emits `captureUrl` plus `captureSelector`; the selector is not caller-configurable. Ordinary preview mode remains available without capture arguments.

Each capture ID captures one page and is single-use. Generate a new ID for every artboard and every diagnosed retry. Capture multiple artboards sequentially because the connector does not support parallel tool calls reliably.

## Locate and verify output

Prefer the node/page identifier returned by completion. If absent, reread top-level pages and diff against the pre-capture list. Read metadata for the generated top-level output and request a screenshot of that same node. Its natural dimensions must equal the authored capture root, and its direct hierarchy must be the intended artboard. Do not link to or verify only a correctly sized descendant when a larger page-sized wrapper still exists.

Keep the code-to-canvas result as the deliverable. Do not build a parallel `use_figma` version, delete the capture, switch to clipboard payloads, or replace it with image/SVG import unless the user explicitly changes the delivery contract.

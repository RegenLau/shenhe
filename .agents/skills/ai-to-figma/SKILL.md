---
name: ai-to-figma
description: Plan web or iOS mobile interfaces from screenshots, Figma frame references, or a product brief; generate and explicitly approve full-screen visual previews for adaptation and independent design; rebuild approved directions as capture-safe static HTML with official assets; and push editable layers into Figma Design with Figma MCP code-to-canvas. Use when a user asks to design, recreate, reference, or independently plan a screen and deliver it directly to Figma.
---

# AI to Figma

Turn a design brief or visual reference into an approved visual direction, rebuild it as validated static HTML, then capture that HTML into an editable Figma Design file.

## Core contract

1. Resolve the brief, reference role, delivery target, fidelity mode, and device before creating the task workspace. Open the delivery-target chooser only for missing target fields. In Codex, insert it with the native `::codex-inline-vis` directive; do not substitute a `visualize` content reference or modal form.
2. Scaffold `design.md` with the resolved mode and without creating `index.html`. For adaptation and independent planning, establish the visual direction, generate a full-screen preview, iterate without a fixed limit, and stop until the user explicitly approves one version.
3. After explicit approval, persist the selected file under `previews/` and run `scripts/record-preview-approval.mjs`. Reconstruction skips this preview gate.
4. Resolve the local-font Typography Plan, inventory every non-text final visual in the Visual Asset Plan, and show both decision tables to the user. The approved full-screen preview is a reference, not a final asset.
5. Resolve every typography and visual-asset row to `ready`, validate all required gates, then create `index.html` with `scripts/init-html.mjs`. Stop on any blocked item.
6. Rebuild the approved direction with static HTML, inline CSS, separate final assets, and only small amounts of native JavaScript. Mark each planned visual with its `data-visual-id`; never embed the full-screen preview or introduce React or a remote runtime.
7. Validate the rendered page and its visual-plan mappings locally before requesting a Figma capture.
8. Use Figma MCP `generate_figma_design` as the delivery path and open only the root-scoped `captureUrl` emitted by `scripts/serve-preview.mjs`. Do not silently fall back to `use_figma`, clipboard HTML, SVG import, or a flat screenshot.
9. Treat every capture ID as single-use. Permit one diagnosed retry with a new capture ID, then stop and report the failure.

## Input roles

- **Brief:** required product/content intent unless the user explicitly requests a literal reconstruction.
- **Reference:** optional screenshot, local image, or node-specific Figma URL used for reconstruction or visual-language extraction.
- **Target:** optional prompt input, but required before work begins. Use an explicitly designated Figma Design URL, or resolve the current Figma identity and plan for a new Design file through the delivery-target gate.
- **Device:** `web` or `mobile`. Infer it only when the prompt or reference makes the class unambiguous.

If one Figma URL could be either a reference or a target, ask which role it has. Never guess.

Interpret “recreate”, “restore”, “1:1”, or equivalent language as reconstruction. Interpret “inspired by”, “reference”, or equivalent language as visual-language adaptation. Otherwise plan the interface from the brief.

## Required references

- Read [references/workflow.md](references/workflow.md) for the state machine and stop conditions.
- Read [references/target-resolution.md](references/target-resolution.md) on every run before creating the task workspace.
- Read [references/design-spec.md](references/design-spec.md) on every run before creating `design.md`.
- Read [references/typography.md](references/typography.md) on every run before resolving fonts or creating `design.md`.
- Read [references/reference-modes.md](references/reference-modes.md) when a screenshot, image, or Figma frame is supplied.
- Read [references/canvas-specs.md](references/canvas-specs.md) for the chosen device. Mobile output must include the complete iOS status bar and home-indicator structure.
- Read [references/asset-policy.md](references/asset-policy.md) when the design contains logos, product identity, photos, illustrations, avatars, mascots, or thumbnails.
- Read [references/icon-system.md](references/icon-system.md) whenever the design contains generic interface icons.
- Read [references/transparent-assets.md](references/transparent-assets.md) whenever an asset needs transparency or image generation.
- Read [references/html-authoring.md](references/html-authoring.md) before writing HTML.
- Read [references/figma-capture.md](references/figma-capture.md) immediately before any Figma write.
- Read [references/validation-and-recovery.md](references/validation-and-recovery.md) before final verification or after any failure.

## Hard prohibitions

- Do not crop a UI reference screenshot into final asset files.
- Do not generate, invent, or approximately redraw an existing brand or product logo.
- Do not regenerate an identity-critical product, person, package, or mascot and present it as the original.
- Do not use an unvalidated transparent asset.
- Do not generate a keyed background or run local background removal for a GPT Image 2 asset; request native transparency and validate the final alpha output.
- Do not reduce a compositionally dominant hero illustration to generic CSS merely because its silhouette is abstract or geometrically reproducible.
- Do not create `index.html` before the Visual Asset Plan passes or continue while any visual is planned, resolving, or blocked.
- Do not create `index.html` before the Typography Plan passes, use a remote or downloaded font, or leave a requested display font unresolved.
- Do not create `index.html` for adaptation or independent planning before an explicitly approved preview is recorded and its hash validates.
- Do not use the approved full-screen preview in HTML, the Visual Asset Plan, or Figma output; rebuild it as editable structure and separate assets.
- Do not generate or distort an identity-critical logo, person, product, package, mascot, or character in a direction preview. Leave a neutral placeholder or use an authorized original without alteration.
- Do not bake required shadows, backgrounds, UI text, or controls into generated subject images.
- Do not mix MingCute with another generic icon family, use an icon font, retain an icon placeholder, or load icons at page runtime.
- Do not send unreviewed HTML to Figma.
- Do not capture `body`, `html`, or the browser viewport; capture only `[data-figma-capture-root]` through the URL emitted by `scripts/serve-preview.mjs`.
- Do not claim delivery until the captured node or page has been reread and visually verified.
- Do not create `.ai-to-figma/<slug>/` while the delivery target is unresolved or an account switch is pending.

## Bundled helpers

Resolve the directory containing this `SKILL.md` as `AI_TO_FIGMA_SKILL_DIR`. Use the bundled scripts from that directory instead of recreating their mechanics; keep generated task files in the user's current project:

```bash
AI_TO_FIGMA_SKILL_DIR="/absolute/path/to/ai-to-figma"
npm install --omit=dev --prefix "$AI_TO_FIGMA_SKILL_DIR"
node "$AI_TO_FIGMA_SKILL_DIR/scripts/render-target-chooser.mjs" --input /thread-visuals/target-state.json --output /thread-visuals/figma-target-chooser.html
node "$AI_TO_FIGMA_SKILL_DIR/scripts/scaffold.mjs" --device web --mode adaptation --slug landing-page
node "$AI_TO_FIGMA_SKILL_DIR/scripts/record-preview-approval.mjs" --dir .ai-to-figma/landing-page --file previews/approved-v3.png
node "$AI_TO_FIGMA_SKILL_DIR/scripts/list-local-fonts.mjs" --query "PingFang"
node "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-design.mjs" --file .ai-to-figma/landing-page/design.md
node "$AI_TO_FIGMA_SKILL_DIR/scripts/init-html.mjs" --dir .ai-to-figma/landing-page
node "$AI_TO_FIGMA_SKILL_DIR/scripts/inline-mingcute-icon.mjs" --file .ai-to-figma/landing-page/index.html --name home-1 --style regular --visual-id home-icon
node "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-html.mjs" --file .ai-to-figma/landing-page/index.html --device web --design .ai-to-figma/landing-page/design.md
node "$AI_TO_FIGMA_SKILL_DIR/scripts/serve-preview.mjs" --dir .ai-to-figma/landing-page --port 4173
node "$AI_TO_FIGMA_SKILL_DIR/scripts/serve-preview.mjs" --dir .ai-to-figma/landing-page --port 4173 --inject-file /task-temp/capture-snippet.html --capture-id <capture-id> --capture-endpoint <capture-endpoint> --capture-delay 1000
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-alpha.py" --input subject-transparent.png --preview-dir alpha-previews
# Legacy compatibility for a user-provided or first-party flat-background asset only:
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/remove-solid-background.py" --input legacy-source.png --out subject-transparent.png --key black --mode light-on-black
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-alpha.py" --input subject-transparent.png --preview-dir alpha-previews --source-key black
```

The generated task directory, approved preview and approval record when required, Figma URL, verification result, asset provenance, and remaining limitations are required final outputs.

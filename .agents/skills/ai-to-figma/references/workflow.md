# Workflow

Use this state machine for every run. Do not reorder its write gates.

## 1. Resolve intent

Identify the brief, reference inputs, Figma target, device, and fidelity language. A Figma URL must have one explicit role: reference or target. Ask when its role is ambiguous.

Choose one mode:

- **Reconstruction:** preserve visible hierarchy, layout, copy, component treatment, and visual rhythm.
- **Adaptation:** extract visual language, then create a new information architecture for the brief.
- **Independent planning:** plan both structure and visual direction from the brief.

## 2. Resolve the delivery target

Follow `target-resolution.md` before creating any task files. Reuse a valid explicitly designated Design target or a complete submitted chooser result. When target fields are missing, call Figma `whoami`, render the chooser with only those missing fields, insert it in the conversation through Codex's native `::codex-inline-vis` directive, and stop until the user submits it. If the current account is wrong, stop until the Figma connection has been switched and verified.

Hard gate: the delivery mode and either a valid existing Design URL or a current account/plan for new-file creation must be explicit. Do not silently choose a plan, and do not create `.ai-to-figma/<slug>/` while this gate is open.

## 3. Create the task workspace

Run the bundled `scripts/scaffold.mjs` from the Skill directory with a stable slug and device. Work only inside the resulting `.ai-to-figma/<slug>/` directory. Never overwrite an existing task directory.

Pass the resolved mode through `--mode reconstruction`, `--mode adaptation`, or `--mode independent-planning`. The scaffold creates `design.md`, `previews/`, asset directories, and `validation-report.json`; it must not create `index.html`. Complete `design.md` using `references/design-spec.md` and `references/typography.md` before HTML exists.

## 4. Establish and approve the visual direction

For adaptation, extract a Style Profile from the exact reference: color roles, typography roles, spacing, radii, borders, elevation, material, component grammar, image treatment, and information density. For independent planning, derive a coherent direction and information architecture from the brief even when it is only one sentence.

Generate one full-screen preview per target artboard at the intended canvas ratio. Treat it as a composition proposal for hierarchy, color, surfaces, imagery, and atmosphere, not as authoritative copy or a final asset. Let the user request image edits or provide a modified version without an iteration limit. Stop until the user explicitly selects a version.

Do not generate or distort identity-critical marks, products, people, packages, mascots, or characters in the preview. Use a neutral placeholder or an authorized original without alteration. After explicit approval, place the selected version under `previews/` and run `scripts/record-preview-approval.mjs`. The approval record freezes its relative path, canvas, mode, timestamp, and SHA-256. Reconstruction records `not-required` and skips this stage.

Hard gate: adaptation and independent planning cannot proceed to HTML without a valid `preview-approval.json`. The approved full-screen preview must never become a final HTML image or Figma layer.

## 5. Resolve typography and final assets

Resolve the Typography Plan before asset and HTML implementation. Use `PingFang SC` for ordinary interface text when it is installed. If it is unavailable, select the first installed Simplified Chinese UI fallback allowed by `references/typography.md`. For reference-driven display lettering, use the requested family only when it is installed and covers the visible text; otherwise choose and document the closest local substitute. Use `scripts/list-local-fonts.mjs` to inspect installed families. Do not download fonts.

Inventory every distinct non-text visual in the Visual Asset Plan before HTML implementation, including hero art, logos, photos, illustrations, avatars, thumbnails, generic icons, device-native visuals, and composition-significant CSS or inline SVG. Show the completed decision table to the user, then continue automatically unless an item is blocked.

Resolve first-party logos and identity-critical product media before deciding whether image generation is needed. Generate, localize, process, and inspect every file asset; record evidence keyed by asset ID. Follow `asset-policy.md` and `transparent-assets.md`.

Reconcile the Typography Plan and Visual Asset Plan against the approved direction. Do not list the approved full-screen preview as an asset; inventory only the separate visuals required to rebuild it.

Hard gate: every typography and visual-asset row must be `ready`, and every resolved family must exist locally. Run `scripts/validate-design.mjs`, then `scripts/init-html.mjs`; never create HTML directly. If any row is `blocked`, stop and report the required user action.

## 6. Build and review HTML

Follow `canvas-specs.md`, `typography.md`, and `html-authoring.md`. Mark each implementation with the matching `data-visual-id`, use only declared font variables, and keep the required-local-font metadata aligned with the Typography Plan. Run `scripts/validate-html.mjs` with both `--file` and `--design`, then run `scripts/serve-preview.mjs`, await `window.captureReady`, render at the target width, and inspect the full page. Fix missing or substituted fonts, missing backgrounds, clipped text, broken assets, overflow, plan mismatches, and visual mismatch before Figma work.

Hard gate: do not request a capture while the local validation report has errors or the visual review is incomplete.

## 7. Revalidate the Figma target

Call Figma `whoami` immediately before the first Figma write. For an existing target, parse its Design file key and optional destination node, then confirm the target metadata/page is accessible under the current identity. For a new target, require the submitted account identity and plan key to remain present in `whoami`; load the Figma create-file guidance and create the Design file in that plan's Drafts. If identity, plan, or access changed, stop and rerun only the delivery-target gate.

Do not persist account identifiers, plan keys, or user-specific file keys in this Skill or repository files.

## 8. Capture

Record the target file’s top-level pages before capture. Request a new `generate_figma_design` capture ID and save the returned snippet in the task workspace. Run `serve-preview.mjs` with `--inject-file`, `--capture-id`, and the exact returned `--capture-endpoint`; then open only the emitted `captureUrl` in a JavaScript-capable browser. That URL is fixed to `[data-figma-capture-root]`. Never assemble the hash manually or capture `body`, `html`, or the browser viewport. Poll every five seconds, at most ten times.

Each capture ID is single-use. Capture multiple artboards sequentially.

## 9. Verify

Locate the output from the capture result or by diffing the page list. Read metadata for the generated top-level node and obtain its screenshot. The top-level node itself must match the authored capture root's width and full height and directly contain the intended artboard hierarchy. A correctly sized nested child inside a larger viewport frame, blank wrapper, or auxiliary container is a failed capture. Check text, opaque backgrounds, image alpha, iOS chrome, and long-page completeness only after this top-level boundary passes.

## 10. Recover or finish

On failure, diagnose the actual class before changing anything. Permit one targeted correction and one new capture ID. If the corrected attempt fails, stop. Preserve `design.md`, HTML, assets, server diagnostics, and the validation report.

Final reporting must distinguish:

- successful capture and verification;
- successful local build but blocked Figma delivery;
- asset or permission blocker;
- remaining visual approximations.

Return the task directory, approved visual-preview path and approval record when required, local HTML preview URL when still active, generated or retrieved final-asset paths, Figma URL, verified node/page, and limitations.

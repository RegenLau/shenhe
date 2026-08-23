# Validation and recovery

## Local structural checks

- The declared design mode is valid. Adaptation and independent planning have a readable `preview-approval.json`; its mode and canvas match `design.md`, its file stays under `previews/`, and its SHA-256 still matches. Reconstruction records `not-required`.
- Final HTML does not reference the approved preview or any file under `previews/`.
- One capture root exists.
- Web is 1440 px wide and at least 900 px high unless explicitly overridden.
- Mobile is 375 px wide and at least 812 px high.
- Mobile has exactly one status bar, content region, home area, and home indicator with the required measurements.
- The root and every critical band have visible opaque fills.
- Every local asset exists and every image loads.
- Every Visual Asset Plan ID appears in HTML through `data-visual-id`, and every HTML visual ID is declared in the plan.
- The preferred UI font is `PingFang SC`; the resolved UI and display families exist locally and match the HTML font variables and capture-root metadata.
- Every `font-family` uses a declared font variable, no `@font-face` or remote/downloaded font exists, and UI weights are limited to the real PingFang set.
- File-backed rows use the exact recorded local image path; MingCute and inline-SVG rows are implemented as inline `<svg>` elements.
- No required content depends on a remote runtime.

## Local visual checks

Inspect the exact-width full-page render after `window.captureReady` resolves. Check the actual computed family, weight, Chinese/Latin/numeric glyph coverage, visual hierarchy, fidelity mode, line wrapping, clipped text, overlap, horizontal overflow, missing backgrounds, broken icons, blank images, and long-page completion. Confirm the iOS foreground colors contrast with their actual top and bottom backgrounds.

## Asset checks

Confirm each HTML asset matches a `ready` row in `design.md`. Compare first-party logo versions with the reference. For alpha assets, inspect white, black, checkerboard, and real-background composites. Reject background rectangles, halos, key-color spill, cropped subjects, unintended transparent holes, baked shadows, undeclared visuals, or code-native substitutes for file-backed art.

## Figma checks

Use metadata to confirm the generated top-level node/page and hierarchy. The top-level node itself must have the capture root's natural width and full height and directly contain the intended artboard; reject browser-sized wrappers, blank trailing containers, and any result that passes only after selecting a nested child. Use a screenshot of that same top-level node to verify text family and weight, image placement, background retention, iOS chrome, long-page height, and transparent edges. A successful capture status without these checks is pending, not complete.

## Failure classes

- reference or official-asset access failure;
- Figma authentication, plan, permission, or target-node failure;
- local server or browser execution failure;
- missing font or asset load failure;
- capture timeout or 50 MB payload limit;
- capture completion without a locatable output;
- capture completion with a viewport-sized outer frame or auxiliary blank container;
- local-to-Figma visual mismatch;
- invalid alpha or identity drift;
- missing, unreadable, mismatched, or modified visual-preview approval;
- final HTML flattened from or directly referencing the approved full-screen preview.

## Recovery

Stop on an error and identify its class. Preserve existing successful artifacts. Make one targeted correction supported by diagnostics, request a new capture ID, and retry once. Do not reuse the first ID or make speculative repeated writes.

After a second failure, stop. Return the exact error, completed local artifacts, diagnostics, target file URL when available, and the next human action. Never describe a blocked handoff as successful.

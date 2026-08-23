# HTML authoring

## Document contract

- Use one `index.html` entry point.
- Inline CSS and small native scripts. Keep image and SVG files local.
- Put `data-figma-capture-root` on the one top-level artboard.
- Put `data-visual-id="<asset-id>"` on every visual listed in the Visual Asset Plan. Repeated uses may share the same ID.
- Give the root an explicit width, a device-appropriate minimum height, and an opaque base background.
- Never reference `previews/` or the approved full-screen visual preview. Rebuild the approved direction as real text, controls, layout, backgrounds, and separately resolved final assets.
- Set `html` and `body` margins to zero and make the page background visibly distinct from the artboard during preview. This preview background stays outside Figma because capture is scoped to `[data-figma-capture-root]`.

Do not use React, external scripts, CDN styles, remote fonts, downloaded fonts, `@font-face`, icon fonts, SVG sprites, or runtime-fetched content. Download authorized non-font sources into the task workspace first.

## Typography

Use `--font-ui` for every ordinary text element. It must reproduce the exact UI font stack recorded in `design.md`, normally beginning with `"PingFang SC"`. Use only numeric UI weights `300`, `400`, `500`, and `600`, and keep `font-synthesis: none` enabled so the browser cannot invent heavier or italic faces.

For display typography, declare the exact CSS variable recorded in its Typography Plan row, put the resolved local family first, and use that variable only in the documented scope. Do not reference a family directly from `font-family`, use the `font` shorthand, or introduce a `--font-*` variable that is absent from the plan. Keep `data-ui-font` and `data-required-local-fonts` on the capture root aligned with every resolved family in the plan.

## Capture-safe visuals

Represent critical backgrounds as actual elements or opaque container fills. Do not rely on a pseudo-element, transparent gradient, blend mode, backdrop filter, or shadow as the only source of a visible region.

Use real HTML text and controls. Use MingCute Core inline SVG for generic icons and follow `icon-system.md`; put its visual ID on the `<svg>` and do not hand-copy framework components into the page. Use local `<img data-visual-id="...">` elements for approved bitmap and brand assets, referencing the exact `assets/final/` path recorded in `design.md`. Add shadows to transparent subjects with CSS, not inside the image.

Keep repeated elements maintainable with semantic markup, shared classes, and small deterministic template functions where useful. Do not add a framework for component organization.

## States

Code-to-canvas captures a rendered state, not an interaction model. Render any required hover, selected, expanded, modal, loading, empty, error, or disabled state as an explicitly visible state artboard or labeled variant. Do not hide required states behind clicks.

## Readiness

Before capture, await `window.captureReady`. Local-family availability must already have passed the operating-system check in `validate-design.mjs`; the browser gate then waits for `document.fonts.ready`, confirms the computed capture-root stack begins with `data-ui-font`, and waits for every image to complete with non-zero natural dimensions. Scroll through a long page once when browser behavior could defer rendering. Run `scripts/validate-html.mjs --file <index.html> --device <web|mobile> --design <design.md>` and inspect a full-page screenshot at the exact target width. Check Chinese, Latin, and numeric samples, line wrapping, clipping, and unintended fallback glyphs.

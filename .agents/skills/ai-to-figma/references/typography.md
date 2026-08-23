# Typography

Resolve every font before HTML initialization. Use installed local families only; do not download, bundle, or load a font through `@font-face`, a CDN, or a remote stylesheet.

## Ordinary interface text

Set the preferred UI family to `PingFang SC`. Resolve the first installed family in this order:

1. `PingFang SC`
2. `Hiragino Sans GB`
3. `Microsoft YaHei`
4. `Noto Sans CJK SC`
5. `Source Han Sans SC`

Record the resolved family and put it first in the CSS stack, followed by the remaining locally appropriate fallbacks and `sans-serif`. On a normal macOS design environment the resolved family and first stack entry must remain `PingFang SC`.

Use only PingFang's real UI weights: `300` Light, `400` Regular, `500` Medium, and `600` Semibold. Do not request `700`, use `bold`, or permit synthesized weight or style for ordinary UI text.

## Display and artistic text

Treat display lettering as an exception, not a new page default. First identify the requested family from the reference when possible, then inspect installed families with `scripts/list-local-fonts.mjs`. If the exact family is unavailable, compare local candidates by:

- required Chinese, Latin, and numeric coverage;
- serif, sans, script, rounded, condensed, or decorative category;
- stroke contrast and weight;
- character width and line length;
- terminals, corners, and overall visual mood.

Choose the closest installed family without asking when the substitution is visually safe. Record the original request or `visual-reference`, resolved family, character coverage, real numeric weights, CSS variable, and substitution reason. Chinese display copy requires a family that renders every visible Han character. A Latin-only display family may affect only the documented Latin scope; surrounding Chinese text stays on the UI family.

## Local verification

Run `scripts/list-local-fonts.mjs --query <term>` to inspect installed family names. `validate-design.mjs` rejects resolved families that the current operating system cannot enumerate. In the exact-width browser preview, await `window.captureReady`, then inspect computed styles and visible glyphs. Reject tofu boxes, mixed fallback glyphs, unexpected width changes, altered line breaks, clipping, or synthetic weight.

After Figma capture, verify the same text at the generated top-level node. A local preview that uses the intended family but a Figma result that substitutes it is a local-to-Figma mismatch and follows the normal diagnosed-retry limit.

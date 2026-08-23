# Asset policy

## Classify before sourcing

Classify every visual as one of:

- identity-critical brand or product media;
- user-provided ordinary media;
- code-native UI or decoration;
- missing non-identity subject that may be generated.

Record every non-text visual in the Visual Asset Plan in `design.md`. Use one stable kebab-case ID per distinct visual; repeated uses may share an ID. Inventory composition-significant CSS and inline SVG as well as file assets and icons. Leave plain fills, ordinary borders, and routine shadow tokens in the visual system.

An approved full-screen visual-direction preview is reference evidence, not a final asset. Keep it under `previews/`, exclude it from the Visual Asset Plan, and rebuild its composition with HTML plus separately resolved assets.

Use only these implementation methods: `user-original`, `project-asset`, `first-party`, `image-generation`, `mingcute-svg`, `inline-svg`, `html-css`, and `device-native`. Move each row through `planned` or `resolving` to `ready`; use `blocked` only when work cannot continue without user action. Never initialize HTML while any row is not `ready`.

Classify identity fidelity and composition importance independently. “Not a brand asset” does not mean “code-native decoration.” An abstract subject can still be the screen's hero illustration.

## Choose the implementation medium

Choose by visual role and fidelity, not by whether CSS could approximate the silhouette.

- Treat a visual as a generated or sourced image asset when it is the primary focal point, occupies a substantial hero area, or carries the screen's atmosphere or product character through layered lighting, volumetric shading, translucency, texture, or illustrative detail.
- Treat a visual as code-native only when it is subordinate decoration or UI structure and a few stable primitives can reproduce its important appearance without flattening the reference.
- In reconstruction mode, preserve the reference's asset role. Do not replace a rich hero illustration with a generic gradient construction merely because both contain circles, lines, or other simple geometry.
- When uncertain, compare the likely visual loss: use an image asset for composition-critical art; use HTML/CSS/inline SVG for layout, controls, backgrounds, and supporting decoration.

Examples: a central glowing planet with a translucent body, orbital trail, bloom, and focal sparkle is hero illustration; a small gradient orb used as a badge background is code-native decoration.

Display the decision table to the user before resolving assets. Continue without waiting for confirmation unless a source, identity, processing, or validation blocker arises.

## Logos and brand marks

Never generate, crop from a UI screenshot, or approximately redraw an existing logo.

This prohibition also applies to direction previews. Use a neutral placeholder or an authorized original without alteration; do not ask image generation to reproduce or stylize an identity-critical mark, person, product, package, mascot, or character.

Search in this order:

1. user-provided original files;
2. the current project or designated asset directory;
3. a product URL supplied by the user;
4. the brand’s official site, brand center, press kit, or first-party CDN.

Process user-provided URLs before broader discovery. Use only first-party sources; reject aggregators, wiki screenshots, logo collections, and third-party replicas. Prefer SVG, then transparent PNG or WebP. Compare the retrieved variant with the reference for geometry, color, orientation, and lockup.

Record source URL and retrieval date. Localize external SVG dependencies. If no matching first-party asset exists, stop and ask for the original. Logo exploration is allowed only when the user explicitly requests a new identity rather than reconstruction.

## Identity-critical media

Use an original or first-party source when a product, package, person, mascot, or character must remain exactly the same. Resizing, format conversion, and background removal are allowed; regenerating it and presenting it as the original is not.

## Ordinary supplied media

Preserve the source under `assets/originals/`. Create optimized or transparent derivatives under `assets/final/`. Never overwrite the source. Do not modify content beyond the user’s request.

## Code-native visuals

Build UI components, charts, status bars, gradients, grids, badges, dividers, simple geometric texture, and ordinary text in HTML/CSS/inline SVG. Build generic product-interface icons with MingCute Core according to `icon-system.md`. Do not call image generation for them.

The presence of gradients or simple geometry alone is insufficient for this classification. This category excludes composition-critical hero art and rich illustration, even when their outer silhouette could be recreated with CSS.

## Generated subjects

Generate only when the source is missing, identity fidelity is not required, and the subject materially contributes to the composition or meaning. Suitable subjects include people, avatars, generic mascots, product-style renders, photos, rich illustrations, and scene thumbnails.

Abstract hero subjects qualify. In reconstruction mode, generate them to match the reference's visual role and treatment rather than copying the whole screenshot or embedding surrounding UI.

Generate each distinct asset separately. Do not put UI copy, buttons, logos, trademarks, or required page backgrounds inside the bitmap. Persist the selected final into the task workspace and record the exact prompt.

Follow `transparent-assets.md` whenever the generated subject needs alpha.

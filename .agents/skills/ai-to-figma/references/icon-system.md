# Icon system

## Default family

Use MingCute Core for generic product-interface icons. Use Core Regular for ordinary actions and inactive states. Use the matching Core Filled icon for selected, emphasized, or active states. Keep one semantic icon name across a state pair and do not mix MingCute with another generic icon family in one design.

MingCute Core uses a 24 × 24 view box. Keep the canonical paths, masks, gradients, and clipping paths unchanged. Keep ordinary paint as `currentColor`; the helper converts the fixed canonical paint in angular-gradient loading icons to `currentColor`-based CSS and expands XML-style self-closing XHTML elements for safe HTML parsing without changing their gradient structure. The generated SVG is a non-shrinking block so complex icons remain 24 × 24 in flex layouts. Override width and height with CSS when the design needs another size.

Device-native system chrome may retain platform-specific geometry. Brand logos, product marks, people, avatars, and identity-critical media are not generic icons; handle them through `asset-policy.md`.

## Authoring workflow

Install the pinned authoring dependency inside the Skill directory once:

```bash
npm install --omit=dev --prefix "$AI_TO_FIGMA_SKILL_DIR"
```

Put an empty placeholder comment at the intended location in task HTML:

```html
<!-- mingcute:regular:home-1 -->
<!-- mingcute:filled:home-1 -->
```

Inline one name and style at a time. The helper replaces every matching placeholder atomically:

```bash
node "$AI_TO_FIGMA_SKILL_DIR/scripts/inline-mingcute-icon.mjs" \
  --file .ai-to-figma/example/index.html \
  --name home-1 \
  --style regular \
  --visual-id home-icon
```

Use only `regular` or `filled`. Set `--visual-id` to the matching Visual Asset Plan ID so the generated `<svg>` participates in HTML validation. Resolve icon names from the installed Core catalogue. Do not import `@mingcute/*` from task HTML, use the icon-font package, retain placeholders, or load icons at page runtime.

Keep icons decorative when nearby text or the owning control already provides an accessible name. Give icon-only controls an `aria-label`; do not add a duplicate label to their SVG.

## Design record

Record the pinned `@mingcute/svg` version, visual ID, icon name, and every Regular/Filled state mapping in the Visual Asset Plan in `design.md`. Record deviations such as device-native system chrome or official brand assets as their own rows.

## License and provenance

The pinned public MingCute Core SVG package is sourced from `@mingcute/svg` by MingCute Design and is licensed under Apache License 2.0. The Skill bundles the applicable license at `licenses/MINGCUTE-APACHE-2.0.txt`. Do not source or redistribute MingCute Pro artwork.

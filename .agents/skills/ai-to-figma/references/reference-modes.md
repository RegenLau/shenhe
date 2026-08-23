# Reference modes

## Screenshot or image reference

Inspect the whole reference. Record canvas class, scroll state, hierarchy, alignment anchors, grid, spacing rhythm, typography, colors, surfaces, borders, elevation, imagery, icons, visible text, and component states. Explicitly identify the visual focal point and every composition-critical image role before choosing an implementation medium.

Do not crop regions into final assets. A reference image is evidence for reconstruction or style extraction, not an asset sheet.

## Figma frame reference

Require a node-specific Figma Design URL. Read structured design context for the exact node and obtain its screenshot. If the response is too large, inspect metadata first and fetch only the required descendants.

Do not treat a file-only URL as a specific frame. Do not treat a reference node as a write destination unless the user explicitly gives it both roles.

## Independent planning

Derive the page goal, audience, primary action, information architecture, major sections, component inventory, content hierarchy, and visual direction. Make reasonable low-risk content assumptions and record them in `design.md`; ask only when missing product intent changes the structure materially.

Generate a full-screen visual-direction preview even when the brief is only one sentence. Iterate through image edits or a user-supplied revision until the user explicitly approves one version, then record that version before final asset resolution or HTML initialization.

## Reconstruction versus adaptation

For reconstruction, preserve visible copy, ordering, density, proportions, major breakpoints, imagery roles, and component treatment. Report unreadable or hidden details as inferred.

For adaptation, extract only reusable visual-language decisions: palette roles, type character, spacing rhythm, radius family, surface treatment, icon character, image treatment, and motion/state cues. Do not copy the source information architecture unless the brief calls for it.

Convert those decisions into a Style Profile, then generate and explicitly approve a full-screen preview before HTML. The approved preview is evidence for the new composition, not an asset to crop, vectorize, or embed.

## Multiple references

Use this precedence:

1. explicit user requirements;
2. designated primary reference;
3. secondary references;
4. AI inference.

When references conflict on a structural decision and no primary source is designated, ask which one controls. For small visual conflicts, use the primary source and document the choice.

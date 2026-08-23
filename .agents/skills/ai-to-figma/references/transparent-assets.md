# Transparent assets

## Principle

When the final asset needs transparency, generate or prepare an isolated subject with a real alpha channel from the start. Never generate a complex scene and then create unnecessary segmentation work.

For a generated subject, use GPT Image 2 native transparency. Request:

- one complete centered subject;
- generous transparent padding on every side;
- a transparent background (`background: transparent` when the image-generation path exposes that control);
- PNG or WebP output with a real alpha channel;
- no environment, floor, props, background gradients, texture, reflections, unrelated ambient glow, cast shadow, contact shadow, watermark, or extra text.

Do not ask GPT Image 2 for a black, white, green, magenta, or other keyed background. Do not run generated GPT Image 2 output through local background removal. Add visual shadows later in CSS; a glow or translucency that belongs to the subject itself may remain in the generated asset.

## Generated transparent subjects

Generate the isolated subject with native transparency, persist the selected PNG or WebP under `assets/final/`, then validate that exact file. If the image-generation tool first saves outside the task workspace, copy the selected output into `assets/final/` before recording evidence or referencing it from HTML. Do not reference an image-generation output outside the task workspace.

Record the exact prompt, model or generation path, native-transparency request, final relative path, and validation evidence in the matching Visual Asset Plan evidence entry.

## Existing alpha

For a user-provided or first-party PNG or WebP that already has transparency, keep the original under `assets/originals/`, copy or optimize the selected derivative under `assets/final/`, and validate the exact final file. It must contain a real alpha channel, transparent corners when expected, a non-empty subject bounding box, adequate padding, and clean edges. Remove an unwanted SVG background rectangle rather than rasterizing a clean vector.

## Validation

Validate native-transparent generated output and existing alpha assets without `--source-key`:

```bash
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-alpha.py" \
  --input assets/final/subject-transparent.png \
  --preview-dir assets/working/subject-alpha-check
```

Inspect the white, black, checkerboard, and actual-page composites. Reject clipped subjects, white, gray, black, or colored halos, unintended holes, flattened translucent regions, baked shadows, residual background blocks, or insufficient transparent padding. Recheck the Figma screenshot after capture.

If GPT Image 2 returns an opaque or otherwise invalid result, permit one targeted regeneration that repeats the native-transparency and output-format requirements. Do not convert that failed generated output into a keyed-background removal workflow. If the second result still fails, stop and report the asset blocker.

## Legacy solid-background removal

Use local background removal only for a user-provided or first-party raster asset that lacks alpha and has a genuinely flat, separable background. Never use this compatibility path for GPT Image 2 output. Preserve the original under `assets/originals/` and write a derivative under `assets/final/`:

```bash
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/remove-solid-background.py" \
  --input assets/originals/subject.png \
  --out assets/final/subject-transparent.png \
  --key black \
  --mode light-on-black
```

Choose the key and removal mode from the actual source:

| Existing source subject | Flat background | Mode |
| --- | --- | --- |
| light or white, solid | pure black | `solid-key` |
| dark or black, solid | pure white | `solid-key` |
| mixed light and dark, solid | pure green or magenta absent from the subject | `solid-key` |
| light, glowing, or translucent | pure black | `light-on-black` |
| dark, glowing, or translucent | pure white | `dark-on-white` |
| mixed light and dark, translucent | pure green or magenta absent from the subject | `chroma-matte` |

`--key` accepts `auto`, `black`, `white`, `green`, `magenta`, or a hex color. Use `auto` only when the existing asset has a known flat border. `solid-key` remains the default compatibility mode. `light-on-black` requires pure black, `dark-on-white` requires pure white, and `chroma-matte` requires pure green or magenta.

Use `solid-key` for opaque subjects. The black/white matte modes reconstruct soft alpha and unmatted RGB for predominantly light or dark translucent subjects. `chroma-matte` estimates alpha from the non-key channels and unmattes the keyed color, so the chosen chroma color must be absent from the subject. The default removes matching key color everywhere, including enclosed holes; use `--connected-only` only when the existing asset intentionally contains the key color in enclosed regions.

Validate the derivative with the explicit legacy source key:

```bash
python3 "$AI_TO_FIGMA_SKILL_DIR/scripts/validate-alpha.py" \
  --input assets/final/subject-transparent.png \
  --preview-dir assets/working/subject-alpha-check \
  --source-key black
```

Permit one evidence-based change of key or mode when the first legacy result is not clean. Do not repeatedly widen tolerances to force a pass. If the source contains complex hair, fur, smoke, glass, liquids, reflections, mixed translucency, or colors that conflict with every safe key, stop and ask for a proper alpha source instead of delivering a broken cutout.

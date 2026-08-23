# Design specification

Copy `assets/design-spec-template.md` into the task directory as `design.md`. Complete and validate it before creating `index.html`, then update it when visual verification changes the design.

The spec is an implementation contract, not brainstorming notes.

## Required decisions

- Goal, audience, primary action, and success state.
- Reconstruction, adaptation, or independent-planning mode.
- Visual Direction source, preview requirement, iteration notes, approved preview, and approval record. Adaptation and independent planning require an explicit approved preview; reconstruction records `not-required`.
- Reference roles and target-file role.
- Web or mobile canvas and any explicit override.
- Section order and component hierarchy.
- Color roles, a complete local-font Typography Plan, spacing, radii, borders, shadows, and background layers.
- A complete visual asset plan covering imagery, icons, device-native visuals, and composition-significant CSS or inline-SVG decoration.
- Visible copy and required states.
- iOS status-bar and home-indicator colors for mobile.
- Asset provenance and transparency requirements.
- Local implementation and capture constraints.
- Known approximations and measurable acceptance checks.

## Visual direction preview

For adaptation, record the extracted Style Profile. For independent planning, record the brief-derived direction and information architecture. Generate the full-screen preview before final asset resolution, iterate until the user explicitly selects a version, then record it with `scripts/record-preview-approval.mjs`.

The preview approves composition, hierarchy, palette, surface treatment, imagery direction, and atmosphere. It does not approve exact copy, accessibility, interaction behavior, or bitmap flattening. Keep it under `previews/`; never add it to the Visual Asset Plan or reference it from final HTML.

## Typography plan

Complete the Typography Plan using `typography.md`. Keep the preferred UI family fixed to `PingFang SC`, record the locally resolved UI family and exact CSS stack, and use only real UI weights `300`, `400`, `500`, and `600`. Set the display-font inventory to `none` when the design has no special display lettering. Otherwise add one ready row per distinct display family and scope, including its resolved local family, supported character coverage, real numeric weights, CSS variable, and exact-match or substitution rationale.

The Typography Plan is a hard gate independent of the Visual Asset Plan. A locally unavailable family, placeholder value, unresolved display font, undeclared substitution, or non-ready row prevents HTML initialization.

## Visual asset plan

Create one row per distinct non-text visual. Repeated uses of the same asset may share a row. Keep plain fills, ordinary borders, and routine shadow tokens in the visual system; inventory hero art, logos, photos, illustrations, avatars, thumbnails, icons, device-native system visuals, and composition-significant CSS or inline SVG.

```markdown
## Visual Asset Plan
- Inventory result: populated | none
- MingCute package version: <exact version>

| ID | 视觉元素/位置 | 作用 | 构图关键 | 身份关键 | 处理方式 | 来源/动作 | 透明要求 | 最终引用 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hero-planet | 首屏中央星球 | 主视觉 | yes | no | image-generation | GPT Image 2 原生透明生成并验证 alpha | yes | assets/final/hero-planet.png | ready |
| menu-icon | 左上菜单 | 导航入口 | no | no | mingcute-svg | 使用 MingCute Core | n/a | name=menu; style=regular; version=3.0.2 | ready |
| ambient-glow | 首屏背景光晕 | 氛围装饰 | no | no | html-css | CSS radial-gradient | n/a | selector=.ambient-glow | ready |
```

Use only these methods: `user-original`, `project-asset`, `first-party`, `image-generation`, `mingcute-svg`, `inline-svg`, `html-css`, and `device-native`. Use only `planned`, `resolving`, `ready`, or `blocked` for status. Display the completed decision table to the user, then continue automatically unless an item becomes blocked.

Before HTML initialization, resolve every row to `ready`. Store image outputs under `assets/final/`; put the exact `name=<name>; style=<regular|filled>; version=<x.y.z>` string in the final-reference column for MingCute; put `selector=<selector>` or an equally specific element reference there for code-native methods. Use the source/action column for acquisition or implementation instructions. An explicit empty inventory is allowed only for a web screen with no non-text visuals. Mobile must inventory its system visuals.

For generated, downloaded, or processed assets, add evidence keyed by the same ID:

```markdown
## Asset Evidence

### hero-planet
- Source provenance: GPT Image 2 image generation
- Retrieval date: 2026-08-20
- Generation path: <model or tool path>
- Generation prompt: <exact prompt>
- Native transparency: requested; output=<PNG or WebP>
- Processing: GPT Image 2 native transparency, alpha validation
- Validation evidence: <local preview paths and inspection result>
- Limitations: none
```

Do not mark an asset ready until the exact final file has been inspected. Generated-image chat previews and files outside the task workspace are not final assets. Do not list logos, product marks, people, or avatars as MingCute icons.

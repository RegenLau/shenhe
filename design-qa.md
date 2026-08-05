# 审核题库轻量化设计 QA

## 验收对象

- Source visual truth: `/var/folders/53/m2_1l3fd2rl09v2mhw2nmx540000gn/T/codex-clipboard-35d953f8-b98c-4999-afc4-e1fbc417fe55.png`
- Implementation URL: `http://127.0.0.1:8888/#/product/question-bank`
- Implementation screenshot: `/Users/regenlau/Desktop/合规审核/shenhe/artifacts/design-qa/question-bank-edit-desktop-1373x801.png`
- Mobile screenshot: `/Users/regenlau/Desktop/合规审核/shenhe/artifacts/design-qa/question-bank-edit-mobile-375x812.png`
- Detail screenshot: `/Users/regenlau/Desktop/合规审核/shenhe/artifacts/design-qa/question-bank-detail-1373x801.png`
- Full-view comparison: `/Users/regenlau/Desktop/合规审核/shenhe/artifacts/design-qa/comparison-full-source-vs-implementation.png`
- Focused drawer comparison: `/Users/regenlau/Desktop/合规审核/shenhe/artifacts/design-qa/comparison-drawer-source-vs-implementation.png`

## 视口与归一化

- Source pixels: `2940 × 1602`; treated as a `1470 × 801` CSS viewport at `@2x` density.
- Desktop implementation: `1373 × 801` CSS px, `devicePixelRatio: 1`; screenshot pixels are `1373 × 801`.
- The in-app browser host is 97 px narrower than the source CSS viewport. The full-view source was right-cropped by 97 CSS px and downsampled to `1373 × 801`, retaining the right-anchored 720 px drawer for like-for-like comparison.
- Focused source drawer: cropped from the source at `1440 × 1600` physical px and normalized to `720 × 800`.
- Focused implementation drawer: cropped at `720 × 800` from the desktop implementation.
- Mobile implementation: `375 × 812` CSS px, `devicePixelRatio: 1`; document `scrollWidth` is 375 px.

## State

- Light theme, authenticated administrator.
- Route: 审核题库.
- Record: `QB-C09-100`.
- Edit drawer scrolled to the AI 回答 and 风险与来源 sections with three selected risk tags.
- Detail drawer scrolled to AI 回答、题目信息、来源信息 and 操作记录.

## Full-view comparison evidence

The combined comparison shows the same application shell, right-anchored drawer, typography family, neutral palette, borders, radii, spacing tokens, overlay treatment, and fixed footer. The source's side-by-side risk selector/rule layout is intentionally replaced by a full-width vertical stack. The five-part answer form is intentionally replaced by one labeled AI 回答 textarea. These are requested product changes rather than fidelity defects.

## Focused region comparison evidence

The focused drawer comparison makes the affected controls readable at 1:1 size. Selected risk tags stay compact and removable; the selector occupies a complete row; rule cards follow underneath at the same width. The single answer textarea preserves existing form typography, color, border, word count, and focus affordance. 去标识化确认 and 升级原因 are absent from edit and detail states.

## Required fidelity surfaces

- Fonts and typography: existing application font stack, weights, sizes, line heights, wrapping, and hierarchy are preserved. Long Chinese rule text wraps without clipping.
- Spacing and layout rhythm: section gaps and drawer padding reuse the existing form system. The requested selector-above-guidance structure is clear at desktop and 375 px.
- Colors and visual tokens: controls and rule cards continue to use existing Arco/application semantic tokens; text and muted guidance retain adequate contrast.
- Image quality and asset fidelity: the affected drawer region introduces no new imagery or replacement assets. Existing shell logo and drug imagery remain unchanged.
- Copy and content: labels are Chinese; AI 回答 has one visible input; 去标识化确认 and 升级原因 no longer appear; source information remains available.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Expected differences from the source are the explicit requested changes: vertical risk layout, one AI answer textarea, and removal of 去标识化确认/升级原因.

## Interaction and runtime checks

- Existing题目 saved successfully without an `is_deidentified` client field.
- Detail view contains one AI 回答 block and contains neither 去标识化 nor 升级原因.
- Desktop and 375 px layouts have no page-level horizontal overflow.
- Browser console warnings/errors checked after navigation, edit, save, detail, and responsive resize: none.

## Comparison history

- Pass 1: no P0/P1/P2 findings. No post-comparison visual fix iteration was required.

## Final result

final result: passed

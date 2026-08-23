# Figma delivery-target gate

Resolve the delivery target before creating `.ai-to-figma/<slug>/`. This gate covers only the Figma destination; keep device, fidelity, and reference-role resolution in the normal intent flow.

## Decision order

1. Reuse a submitted `destination_mode`, `target_url`, `plan_key`, and account identity after validating them. Never reopen the chooser merely because the values arrived through the native inline component.
2. Accept an explicitly designated `https://figma.com/design/<fileKey>/...` or `https://www.figma.com/design/<fileKey>/...` target without opening the chooser.
3. When the user explicitly requests a new file and names a team or organization, call Figma `whoami`. Match only a case-insensitive exact plan name after trimming whitespace; never fuzzy-match. Continue without a chooser only when exactly one returned plan matches.
4. Otherwise call `whoami` and collect only the missing target fields. Do not scaffold, resolve assets, or build HTML while this gate is open.

Keep the existing ambiguity rule: if a supplied Figma URL could be either reference or target, resolve that role first. A URL explicitly used as a reference does not satisfy this delivery gate.

## Native Codex inline chooser

When Codex inline visualization is available, insert the chooser as a native component in the conversation. Do not use a `visualize` content reference, modal input, `request_user_input`, Markdown controls, or a prose questionnaire.

1. Locate the current thread-scoped writable directory whose path contains `.codex/visualizations/`. Create a small temporary JSON file there, never inside this Skill or the checked-out repository.
2. Include `language`, the `account` handle/email from `whoami`, the returned `plans`, and only known destination fields:

```json
{
  "language": "zh",
  "account": { "handle": "Current user", "email": "user@example.com" },
  "plans": [{ "key": "team::123", "name": "Product", "seat": "full", "tier": "pro" }],
  "known": { "destinationMode": null, "targetUrl": "" }
}
```

3. Run `node scripts/render-target-chooser.mjs --input <state.json> --output <figma-target-chooser.html>` with a new ASCII output filename in the same thread-scoped visualization directory. The renderer accepts only `.codex/visualizations/` paths, rejects paths inside the distributable Skill, and does not overwrite an existing fragment.
4. Read the generated fragment back. Verify that it contains literal HTML rather than escaped `\"` or `\n`, and that `window.openai.sendFollowUpMessage` is present.
5. Return only the native inline directive below in the final response, using the generated file's basename. Then end the turn and wait for the submitted follow-up. Do not treat local clicks as answers.

```text
::codex-inline-vis{file="figma-target-chooser.html"}
```

Set `known.destinationMode` to `existing` when only the URL is missing, or `new` when only the plan is missing. Leave it `null` only when the destination mode itself is unknown. Do not include a project-folder field; new files go to the selected plan's Drafts.

The chooser submits one of these stable contracts:

- `$ai-to-figma destination_mode=existing target_url="<design-url>"`
- `$ai-to-figma destination_mode=new account_email="<email>" plan_key="<key>" plan_name="<name>"`
- `$ai-to-figma account_action=switch_required account_email="<current-email>"`

If `account_action=switch_required` arrives, stop before scaffolding and ask the user to switch the Figma connection. After they confirm, call `whoami` again and rerun only this gate.

Only when the host genuinely does not support Codex inline visualization, ask one compact chat question containing only the missing destination fields and wait. Never infer a target or silently choose among multiple plans.

## Revalidation before write

Immediately before creating a file or requesting a capture, call `whoami` again. Compare account email case-insensitively and `plan_key` verbatim. For a new file, require both to remain present; otherwise stop and rerun the gate. For an existing file, require the metadata/page preflight to succeed under the current identity. Keep account data, plan keys, and file keys transient; never add them to Skill or repository files.

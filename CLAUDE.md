# Project Guidelines

## Purpose

This repository is a SaiAdmin 5.x frontend prototype workspace for product managers and AI-assisted UI development. It includes a standalone HTTP Mock API, but no database or production backend logic.

## Architecture Boundary

- Vue pages call functions in `src/api`; pages never import Mock fixtures directly.
- `src/api` sends real HTTP requests through the existing Axios wrapper.
- Development requests use the Vite `/dev` proxy and are served by `mock-api`.
- Mock responses follow `{ code, message, data }` and should match the future backend contract.
- Replacing Mock with a real backend should require environment changes, not page rewrites.

## Project Structure

- `src/views/product/`: product pages created for this project.
- `src/api/product/`: product API modules used by those pages.
- `mock-api/src/`: Mock HTTP routes and response behavior.
- `mock-api/data/`: fixture data only; no database implementation.

## Mandatory Design Documentation

Before creating or changing product UI, read `docs/README.md` and the documents it routes to:

1. `docs/design-system.md`: visual, interaction, responsive, state, copy, and accessibility rules.
2. `docs/components.md`: SaiAdmin/Arco component selection, real props, and Mock dependencies.
3. `docs/page-patterns.md`: canonical list, form, detail, dashboard, and state patterns.
4. `docs/feature-workflow.md`: page/API/Mock/menu workflow and completion criteria.

These local documents are the executable project standard. Official sites and external AI skills are references only. Existing pages under `src/views/system` are implementation references, not proof that their APIs are covered by the current Mock or that they meet every new rule.

## UI Implementation Rules

- Use existing `Sa*` / `Ma*` components first, then Arco Design Vue. Do not add a second UI library.
- Use Vue APIs from the locally installed `@arco-design/web-vue` 2.57.x baseline; never copy React component APIs into this project.
- Keep new pages in JavaScript with `<script setup>`; do not adopt an external skill's TypeScript preference.
- Use Arco/SaiAdmin theme tokens for text, background, border, primary, and status colors. Do not hardcode the Arco default blue or the current configurable primary color.
- Start from the matching pattern in `docs/page-patterns.md`; do not invent a new list/form/detail structure when an existing pattern fits.
- Every asynchronous feature must handle loading, normal, initial empty, filtered empty, error/retry, permission, and long-content states as applicable.
- Keep page-level layout responsive and free of horizontal scrolling. Tables may scroll inside their own container.
- Before using user, resource, upload, import, or export components, implement and verify the Mock endpoints listed in `docs/components.md`.

## Change Rules

- Keep the existing Vue 3, Arco Design, JavaScript, and Yarn 1 conventions.
- Prefer existing SaiAdmin components and page patterns before adding new abstractions.
- Do not modify framework-level files under `src/components`, `src/layout`, `src/router`, or `src/utils` unless the requested feature requires it.
- Keep business pages, API modules, and Mock routes aligned by module name.
- Only edit `CLAUDE.md`; `AGENTS.md` is its symlink mirror.

## Verification

- Run `yarn build` after frontend changes.
- Run the Mock API checks and verify `/health` after Mock changes.
- For end-to-end changes, verify the frontend still reaches Mock through the Vite proxy.
- Apply the visual and interaction checklist in `docs/design-system.md` and the completion definition in `docs/feature-workflow.md` for product features.

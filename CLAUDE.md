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

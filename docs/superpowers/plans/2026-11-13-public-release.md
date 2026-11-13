# PosterLight Public Release Plan

**Goal:** Make PosterLight something any Plex user can install and run, not only its first owner.

**Decisions (owner, 2026-11-13):** free download and self-hosted; shared community fact pack; open source on GitHub (MIT). Nothing is published without the owner's approval.

**Spec:** `docs/superpowers/specs/2026-11-13-posterlight-spec.md`, plus the decisions above.

## Global Constraints

- All constraints of the first plan still apply (iOS 12 baseline for the device page, no npm dependencies, token never leaves the helper).
- A person's Plex token stays on that person's own computer. PosterLight has no server of its own.
- Setup must not need a text editor or a hand-copied token.
- Setup actions are accepted only from the helper computer itself, or with the setup code the helper prints.
- No push, no GitHub repository, no Docker image upload without the owner's explicit yes.

## Tasks

### A. Fact pack that matches any library

Titles differ by language and edition, so a file name is a weak key for a shared pack.

- Fact files gain an optional `"ids"` list, for example `["imdb://tt0078748"]`.
- `parseGuids(json) -> [String]` in `lib/plex-parser.js` reads the `Guid` list of a Plex metadata response.
- `createFactStore` gains `factsFor(session, guids)`. Lookup order: ids, then `<slug>-<year>.json`, then `<slug>.json`.
- The helper already fetches each title's metadata for the cast. It keeps the ids from the same answer.
- Tests: id match wins when the title differs; no ids falls back to the name; a show matches by the show's ids.

### B. Setup in the browser, with Plex sign-in

- With no usable config the helper starts in setup mode instead of stopping. It prints the setup address and a 6-digit setup code.
- `lib/plex-account.js`: `createPin()`, `checkPin(id)`, `listServers(token)` against `plex.tv/api/v2` (injected `fetchImpl`).
- `lib/setup.js`: the setup steps as functions with injected dependencies: start sign-in, poll sign-in, choose server (tries each connection, local first, and keeps the first that answers), manual address and token, save `config.json`.
- `lib/http-server.js`: `POST /api/setup/*`. Rules: request from loopback, or a correct setup code; JSON body; the custom header `X-PosterLight: 1` (stops other websites from posting to the helper).
- `public/setup.html` + `public/js/setup.js`: sign in with Plex, pick a server, done. A second tab for manual address and token.
- The device page shows "Finish setup on the helper computer" while the helper is in setup mode.
- The helper starts polling as soon as setup saves. No restart.
- Paths: `POSTERLIGHT_CONFIG` and `POSTERLIGHT_DATA` environment variables override the default locations (for Docker and NAS).
- Tests: every rule above, with fake plex.tv and fake Plex servers. No test touches the real plex.tv.

### C. Packaging and project files

- `Dockerfile`, `docker-compose.yml`, `.dockerignore`.
- `start-windows.bat`, `start-mac.command`: double-click starters.
- `LICENSE` (MIT), `CONTRIBUTING.md` (how to add facts, how to report a problem), `SECURITY.md`.
- `.github/workflows/test.yml` (runs `npm test`), issue templates.
- README rewritten for any reader: quick start first, then per-system install, then devices.
- A notice that PosterLight is not affiliated with Plex.

### D. Verify and hand over

- `npm test` green. End-to-end run of setup mode against fake plex.tv and fake Plex.
- Report what could not be tested here: real Plex sign-in, Docker build (if Docker is not installed).
- List what the owner must decide before publishing: repository name, author name and email in the git history, first release tag.

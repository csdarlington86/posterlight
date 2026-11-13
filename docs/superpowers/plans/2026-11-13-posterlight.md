# PosterLight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn spare tablets and phones into a theater poster case that shows what is playing on the owner's Plex server.

**Architecture:** A zero-dependency Node.js helper polls Plex `/status/sessions` every 2 seconds, keeps the Plex token, and decides everything that must be the same on every device: state, brightness level, and the active fact. Devices load one static ES5 web page from the helper and poll `GET /api/status` every 2 seconds. Images go through the helper, which asks Plex's own photo transcoder to resize them, so the helper needs no image library.

**Tech Stack:** Node.js 18 or later (built-in `http`, `fetch`, `crypto`, `zlib`, `node:test`). No npm dependencies. Plain ES5 JavaScript, HTML, and CSS in the browser. No build step.

**Spec:** `docs/superpowers/specs/2026-11-13-posterlight-spec.md`

## Global Constraints

- Browser baseline is iOS 12 Safari. Browser code is ES5 only: `var`, `function`, `XMLHttpRequest`. No arrow functions, `let`/`const`, template strings, optional chaining, nullish coalescing, `fetch`, `Promise`, flexbox `gap`, `aspect-ratio`, or `ResizeObserver`.
- Extras (Screen Wake Lock, `env(safe-area-inset-*)`) go behind feature detection.
- Animate only `transform` and `opacity`.
- Fonts are local files in `public/fonts/`. No CDN at runtime.
- The Plex token never appears in any HTTP response, URL sent to a device, or log line.
- No npm dependencies. No paid APIs or AI services at runtime.
- Brand: name `PosterLight`, tagline `Now showing at home.` Colors: background `#14110F`, amber `#FFC857`, cream `#F6EFE2`, bright bulb `#FFE9A8`, dim bulb `#7A5C1E`. Display font Limelight. Body font Inter.
- Timing values: full brightness `180000` ms from session start; fact shown `60000` ms; tap wake `30000` ms; intermission after `10000` ms paused; movie `15` facts; episode `3` facts; helper poll `2000` ms; device poll `2000` ms.
- Default helper port: `8686`.
- Facts in fact files must be real and verifiable. Leave out anything uncertain.
- Server code uses CommonJS (`require`). Tests run with `node --test`.
- Commit after each task. Local git only. Never push.

## Review Focus

1. **Unknown or very short runtime** (duration 0, or shorter than 15 × 60 s). Expected: no crash, no overlapping facts; fewer or no facts. Test in Task 4.
2. **Title with odd characters** (`WALL·E`, `Amélie`, `Se7en`, `M*A*S*H`, `Tom & Jerry`). Expected: the fact file still matches. Test in Task 5.
3. **Plex returns something unexpected** (no `Metadata` key, a session with no `Player`, HTML error page, live TV or photo session). Expected: the helper treats it as "no usable session", not a crash. Test in Task 2.
4. **Two devices, two players, one paused** and **a followed player that disappears mid-movie**. Expected: each device sees only its own player's state; a vanished player goes idle. Test in Task 3.
5. **Image request for an unknown id or a wild size** (`/img/zzz`, `w=999999`, `w=abc`). Expected: 404 for unknown ids; sizes clamped; the helper never fetches a URL a device supplied. Test in Task 7.

---

## File Structure

```
package.json                 scripts: start, test, library, icons
config.example.json          { "plexUrl": "http://192.168.1.10:32400", "plexToken": "PUT-TOKEN-HERE", "port": 8686 }
config.json                  owner's real values (gitignored)
server.js                    entry: load config, wire modules, start poll loop and HTTP server
lib/config.js                load and validate config
lib/plex-parser.js           Plex JSON -> normalized sessions
lib/session-tracker.js       state machine per player (pure, injected clock)
lib/fact-scheduler.js        slot math (pure)
lib/slug.js                  title -> file slug
lib/fact-store.js            read fact files, pick facts, persist TV pool use
lib/fallback-facts.js        facts from Plex metadata + library index
lib/library-index.js         "other titles in my library" lookups
lib/plex-client.js           HTTP calls to Plex (token lives here only)
lib/image-registry.js        opaque image ids -> Plex source paths
lib/status.js                assemble the JSON a device receives
lib/demo.js                  canned statuses for ?demo=
lib/http-server.js           routes and static files
public/index.html            single page
public/css/posterlight.css
public/js/logic.js           pure view logic (UMD: browser global + Node require)
public/js/app.js             DOM, polling, wake lock, setup screen
public/fonts/                Limelight + Inter (woff2, woff) + OFL.txt
public/icons/                logo.svg + PNG sizes
public/manifest.webmanifest
public/demo/                 placeholder poster and headshot SVGs for demo mode
scripts/list-library.js      writes data/library.json, prints titles with no fact file
scripts/build-icons.js       writes public/icons/*
facts/movies/<slug>-<year>.json
facts/shows/<slug>.json
data/                        runtime state (gitignored): fact-state.json, players.json, library.json
tests/*.test.js, tests/fixtures/*.json
README.md
```

## Shared Shapes

**Session** (output of the parser, used everywhere on the helper):

```js
{ playerId, playerName, playerState,        // 'playing' | 'paused' | 'buffering'
  type,                                     // 'movie' | 'episode' | 'track'
  ratingKey, title, year, contentRating, durationMs, viewOffsetMs,
  showTitle, seasonNumber, episodeNumber, showRatingKey,   // episodes, else null
  artist, album,                                            // tracks, else null
  studio, directors: [String], cast: [{ name, role, thumb }],
  posterPath }                              // Plex path or absolute URL, or null
```

`posterPath` rule: movie → `thumb`. Episode → `parentThumb` (season art), then `grandparentThumb`, then `thumb`. Track → `parentThumb` (album art), then `thumb`.

**Status** (what `GET /api/status` returns):

```js
{ plexOk: true, player: { id, name } | null,
  state: 'idle' | 'playing' | 'intermission',
  brightness: 'full' | 'dim',
  media: { type, title, subtitle, year, rating, runtimeMin, posterId, posterShape,  // 'portrait' | 'square'
           cast: [{ name, role, imgId }] } | null,
  fact: { index, total, text } | null }
```

`subtitle`: episode → `S2 · E5 · Episode Title` with show name as `title`. Track → `Artist · Album`. Movie → `''`.

---

### Task 1: Scaffold and config

**Files:** Create `package.json`, `.gitignore`, `config.example.json`, `lib/config.js`, `tests/config.test.js`

**Interfaces:**
- Produces: `loadConfig(filePath, env) -> { plexUrl, plexToken, port }`. Env `PLEX_URL`, `PLEX_TOKEN`, `PORT` override the file. `plexUrl` has no trailing slash. Throws `Error` whose message names the missing field and `config.json` when `plexUrl` or `plexToken` is missing or still `PUT-TOKEN-HERE`.

- [ ] **Step 1:** `git init`. Write `.gitignore` with `config.json`, `data/`, `node_modules/`, `.DS_Store`. Write `package.json` (`"private": true`, `"engines": {"node": ">=18"}`, scripts `start: node server.js`, `test: node --test tests/`, `library: node scripts/list-library.js`, `icons: node scripts/build-icons.js`).
- [ ] **Step 2:** Write failing tests: file values load; env overrides file; trailing slash removed (`http://x:32400/` → `http://x:32400`); default port `8686`; placeholder token throws with message matching `/plexToken/` and `/config\.json/`; missing file with full env works.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 4:** Implement `lib/config.js`.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit `chore: scaffold project and config loader`.

### Task 2: Plex response parsing

**Files:** Create `lib/plex-parser.js`, `tests/plex-parser.test.js`, `tests/fixtures/sessions-movie.json`, `sessions-episode.json`, `sessions-track.json`, `sessions-empty.json`, `sessions-mixed.json`

**Interfaces:**
- Produces: `parseSessions(json) -> [Session]`; `parseLibraryItems(json) -> [{ ratingKey, type, title, year, studio, directors, cast: [String] }]`.

Fixtures follow the real Plex shape: `{ "MediaContainer": { "size": 1, "Metadata": [ { "type": "movie", "ratingKey": "101", "title": "...", "year": 1979, "contentRating": "R", "duration": 7020000, "viewOffset": 60000, "thumb": "/library/metadata/101/thumb/1", "studio": "...", "Director": [{"tag": "..."}], "Role": [{"tag": "...", "role": "...", "thumb": "https://metadata-static.plex.tv/..."}], "Player": {"machineIdentifier": "abc", "title": "Living Room", "state": "playing"} } ] } }`. Episodes add `grandparentTitle`, `grandparentRatingKey`, `parentIndex`, `index`, `parentThumb`, `grandparentThumb`. Tracks add `grandparentTitle` (artist), `parentTitle` (album), `parentThumb`. `sessions-mixed.json` holds one movie on player `abc`, one paused episode on player `def`, one `type: "clip"` session, and one movie with no `Player`.

- [ ] **Step 1:** Write failing tests:
  - movie fixture → one Session with `type 'movie'`, `durationMs 7020000`, `viewOffsetMs 60000`, `playerId 'abc'`, `directors` array of strings, `cast[0]` has `name`, `role`, `thumb`, `posterPath '/library/metadata/101/thumb/1'`.
  - episode fixture → `showTitle`, `seasonNumber`, `episodeNumber`, `showRatingKey` set; `posterPath` equals `parentThumb`; with `parentThumb` removed it equals `grandparentThumb`.
  - track fixture → `artist`, `album` set; `posterPath` equals album `parentThumb`; `cast` is `[]`.
  - empty fixture (`MediaContainer` with no `Metadata`) → `[]`.
  - mixed fixture → exactly 2 sessions (clip and player-less session dropped).
  - `parseSessions(null)`, `parseSessions({})`, `parseSessions('<html>')` → `[]`, no throw.
  - missing `viewOffset` → `0`; missing `duration` → `0`.
- [ ] **Step 2:** Run `node --test tests/plex-parser.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement `lib/plex-parser.js`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: parse Plex sessions and library items`.

### Task 3: Session tracker (playing, paused, idle)

**Files:** Create `lib/session-tracker.js`, `tests/session-tracker.test.js`

**Interfaces:**
- Consumes: `[Session]` from Task 2.
- Produces: `createTracker({ now, pauseGraceMs, fullBrightMs })` returning
  - `update(sessionsOrNull)` — `null` means Plex could not be reached.
  - `view(playerId) -> { plexOk, state, brightness, session, offsetMs, startedAt }`. `playerId` `'any'` follows the first playing session, else the first session.
  - `players() -> [{ id, name, active }]` — every player seen since start, plus any loaded with `loadPlayers(list)`.

Rules: a session's identity is `playerId + ratingKey`; a new identity sets `startedAt = now()`. `brightness` is `'full'` while `now() - startedAt < fullBrightMs`, else `'dim'`. `playerState` `'buffering'` counts as playing. `state` is `'intermission'` once the session has been paused for `pauseGraceMs` or longer; before that it stays `'playing'`. `offsetMs` is the last `viewOffsetMs` plus wall time since it last changed, only while playing, capped at `durationMs`. On `update(null)`: keep every session, set `plexOk false`, keep extrapolating; a held session whose `offsetMs` reaches `durationMs` becomes idle. No session for the player → `state 'idle'`, `session null`, `brightness 'dim'`.

- [ ] **Step 1:** Write failing tests with a fake clock (`var t = 0; now: function () { return t; }`):
  - no update yet → `view('abc').state === 'idle'`.
  - playing session → `'playing'`, `'full'`; advance to `179999` → `'full'`; `180000` → `'dim'`.
  - offset extrapolates: `viewOffsetMs 60000`, advance 5000 with the same reported offset → `offsetMs 65000`; never exceeds `durationMs`.
  - pause: at `9999` ms paused → `'playing'`; at `10000` → `'intermission'`; resume → `'playing'` and `startedAt` unchanged.
  - paused offset does not advance.
  - new `ratingKey` on the same player → `startedAt` resets, brightness `'full'` again.
  - session disappears → `'idle'`.
  - two players: `abc` playing and `def` paused 10 s → `view('abc')` playing, `view('def')` intermission, `view('any')` returns `abc`.
  - `update(null)` after a playing session → still `'playing'`, `plexOk false`, offset still advancing; next good update → `plexOk true`.
  - `update(null)` held until offset reaches duration → `'idle'`.
  - `players()` lists `abc` with `active true`, and after it disappears `active false`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: session tracker state machine`.

### Task 4: Fact scheduling

**Files:** Create `lib/fact-scheduler.js`, `tests/fact-scheduler.test.js`

**Interfaces:**
- Produces:
  - `slotOffsets(durationMs, count) -> [Number]` — slot `i` (0-based) starts at `Math.round(durationMs * (i + 1) / (count + 1))`.
  - `activeSlot(durationMs, count, offsetMs, showMs) -> Number` — index of the slot where `start <= offsetMs < start + window`, else `-1`. `window = Math.min(showMs, 0.8 * durationMs / (count + 1))`.
  - `fitCount(durationMs, wanted, available) -> Number` — `Math.min(wanted, available)`, and `0` when `durationMs <= 0`.

Scheduling uses the playback position, not the wall clock. A pause or a seek moves every device together, and a helper restart does not change which fact shows.

- [ ] **Step 1:** Write failing tests:
  - `slotOffsets(7200000, 15)` has 15 values, first `450000`, last `6750000`, equal gaps of `450000`.
  - `slotOffsets(1800000, 3)` → `[450000, 900000, 1350000]`.
  - `activeSlot(7200000, 15, 449999, 60000) === -1`; at `450000` → `0`; at `509999` → `0`; at `510000` → `-1`; at `6750000` → `14`.
  - short runtime: `activeSlot(300000, 15, o, 60000)` never returns two different slots for one offset, and the window is `15000` (0.8 × 18750).
  - `activeSlot(0, 15, 0, 60000) === -1`; `slotOffsets(0, 15)` → `[]`; `count 0` → `[]` and `-1`.
  - `fitCount(7200000, 15, 9) === 9`; `fitCount(0, 15, 20) === 0`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: fact slot scheduler`.

### Task 5: Fact store (files, no repeats, TV pool)

**Files:** Create `lib/slug.js`, `lib/fact-store.js`, `tests/slug.test.js`, `tests/fact-store.test.js`

**Interfaces:**
- Produces:
  - `slugify(title) -> String` — lowercase; strip diacritics (`normalize('NFD')`, drop combining marks); `&` → `and`; every other run of non `a-z0-9` → `-`; trim `-`.
  - `createFactStore({ factsDir, statePath })` returning `factsFor(session) -> [String] | null` (`null` = no fact file).
- Fact file format: `{ "title": "Alien", "year": 1979, "facts": ["...", "..."] }`. Movies at `facts/movies/<slug>-<year>.json`. Shows at `facts/shows/<slug>-<year>.json` if present, else `facts/shows/<slug>.json`.

Rules: movie → up to 15 facts, chosen by a shuffle seeded from `ratingKey` (same movie gives the same order every time, with no repeats inside a viewing). Episode → 3 facts from the show's pool. The store persists `{ showSlug: { used: [index], episodes: { ratingKey: [index, index, index] } } }` to `statePath`. An episode seen before gets the same 3 facts. A new episode takes unused indexes; when fewer than 3 are unused, it takes what is left, clears `used`, and fills the rest from the fresh pool without duplicating inside the episode. Track → `null`. Blank or non-string facts are dropped. A file that is not valid JSON counts as no file and logs one warning.

- [ ] **Step 1:** Write failing slug tests: `'WALL·E'` → `'wall-e'`; `'Amélie'` → `'amelie'`; `'Se7en'` → `'se7en'`; `'M*A*S*H'` → `'m-a-s-h'`; `'Tom & Jerry'` → `'tom-and-jerry'`; `'  The Thing! '` → `'the-thing'`.
- [ ] **Step 2:** Write failing store tests using a temp dir (`fs.mkdtempSync`):
  - movie file with 20 facts → 15 returned, all different, all from the file; a second call returns the same array.
  - movie file with 6 facts → 6 returned.
  - no file → `null`.
  - show pool of 7: episode A gets 3, episode B gets 3 with no overlap with A, episode C gets 3 with no duplicate inside C and includes the 1 unused fact.
  - episode A asked again → same 3 as before, also after creating a new store on the same `statePath`.
  - invalid JSON file → `null`, no throw.
  - track session → `null`.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement both modules.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit `feat: fact store with seeded picks and TV pool`.

### Task 6: Fallback facts and library index

**Files:** Create `lib/library-index.js`, `lib/fallback-facts.js`, `tests/fallback-facts.test.js`

**Interfaces:**
- Consumes: items from `parseLibraryItems` (Task 2); Session.
- Produces:
  - `buildLibraryIndex(items) -> { otherByDirector(name, excludeTitle) -> [title], otherByActor(name, excludeTitle) -> [title] }` (up to 3 titles each, sorted by title).
  - `buildFallbackFacts(session, index) -> [String]`.

Sentences, each added only when its data exists, in this order:
1. `<Title> was released in <year>.`
2. `Directed by <A>.` (two: `A and B`; more: `A, B and C`)
3. `<Director> also directed <T1>, <T2> and <T3> in your library.` (one per director with matches)
4. `A <Studio> production.`
5. For each of the first 5 cast members with a role: `<Name> plays <Role>.`
6. For each of the first 5 cast members with matches: `You can also see <Name> in <T1> and <T2> in your library.`
7. Episodes only: `This is season <S>, episode <E> of <Show>.`

Tracks return `[]`.

- [ ] **Step 1:** Write failing tests: full movie session gives the sentences above with exact text; a session with only a title gives `[]`; the current title never appears in an "also" sentence; an empty index gives no "library" sentences; track → `[]`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: fallback facts from Plex metadata`.

### Task 7: Plex client and image registry

**Files:** Create `lib/plex-client.js`, `lib/image-registry.js`, `tests/plex-client.test.js`, `tests/image-registry.test.js`

**Interfaces:**
- Consumes: config from Task 1.
- Produces:
  - `createPlexClient({ plexUrl, plexToken, fetchImpl, timeoutMs })` returning `getJson(path) -> Promise<Object>` and `getImage(sourcePath, w, h) -> Promise<{ contentType, body: Buffer }>`. The token goes in the `X-Plex-Token` header, with `Accept: application/json`. `getImage` calls `/photo/:/transcode?width=W&height=H&minSize=1&upscale=0&url=<encodeURIComponent(sourcePath)>`. Any thrown `Error` has the token removed from its message. Default `timeoutMs` `8000`.
  - `createImageRegistry()` returning `idFor(sourcePath) -> String | null` (16 hex chars of SHA-1; `null` for empty input), `sourceFor(id) -> String | null`, and `clampSize(value) -> Number` (integer; non-numbers → `400`; clamp to `64..1600`; round up to the next `100`).

- [ ] **Step 1:** Write failing tests with a fake `fetchImpl` that records calls:
  - `getJson('/status/sessions')` calls `http://x:32400/status/sessions` with both headers.
  - `getImage('/library/metadata/1/thumb/2', 400, 600)` builds the transcode URL above and returns the buffer and content type.
  - a non-200 response rejects; a rejected fetch whose message contains the token rejects with a message that does not contain the token.
  - `idFor` is stable, 16 hex chars; `sourceFor(idFor(p)) === p`; `sourceFor('zzz') === null`; `idFor('') === null`.
  - `clampSize('abc') === 400`; `clampSize(999999) === 1600`; `clampSize(10) === 100`; `clampSize(350) === 400`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: Plex client and image registry`.

### Task 8: Status assembly, HTTP server, poll loop, demo mode

**Files:** Create `lib/status.js`, `lib/demo.js`, `lib/http-server.js`, `server.js`, `public/demo/*.svg`, `tests/status.test.js`, `tests/http-server.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `buildStatus(view, deps) -> Status` where `deps = { factsFor, fallbackFor, images }`. Fact choice: `facts = factsFor(session) || fallbackFor(session)`; `count = fitCount(durationMs, type === 'episode' ? 3 : 15, facts.length)`; `i = activeSlot(durationMs, count, view.offsetMs, 60000)`; `fact` is `{ index: i, total: count, text: facts[i] }` or `null`. Always `null` for tracks and when `state` is not `'playing'`. `posterShape` is `'square'` for tracks, else `'portrait'`. `runtimeMin = Math.round(durationMs / 60000)`.
  - `demoStatus(name) -> Status | null` for `movie`, `movie-fact`, `movie-dim`, `tv`, `music`, `intermission`, `idle`. Demo image ids start with `demo-` and map to files in `public/demo/`.
  - `createHttpServer(deps) -> http.Server` with routes:
    - `GET /api/status?player=<id|any>&demo=<name>` → Status JSON, `Cache-Control: no-store`. Missing `player` → `any`.
    - `GET /api/players` → `{ players: [{ id, name, active }] }`.
    - `GET /img/<id>?w=&h=` → image bytes, `Cache-Control: max-age=86400`. Unknown id → 404. Plex failure → 502. Keeps the last 60 images in memory keyed by `id + w + h`.
    - `GET /healthz` → `{ ok: true, plexOk }`.
    - anything else → static file from `public/` (no path may leave `public/`; `/` → `index.html`). Correct content types for `.html .css .js .json .webmanifest .svg .png .woff .woff2 .txt`.
  - `server.js`: loads config; polls `/status/sessions` every 2000 ms into the tracker (`update(null)` on error); for each new session identity fetches `/library/metadata/<ratingKey>` (movies) or `/library/metadata/<showRatingKey>` (episodes) once to get the full cast; refreshes the library index at start and every 6 hours; saves seen players to `data/players.json`; prints `PosterLight is running. Open http://<lan-ip>:8686 on your device.` for each non-internal IPv4 address. A missing or bad config prints the config error and exits with code 1.

- [ ] **Step 1:** Write failing `status` tests: playing movie at offset inside slot 0 → `fact.index 0`, `fact.total 15`; between slots → `fact null`; intermission → `fact null`; track → `fact null`, `posterShape 'square'`, `cast []`; episode subtitle `S2 · E5 · <title>`; idle view → `media null`; no fact file → fallback facts used; serialized Status never contains a `thumb` URL, a Plex path, or the string `X-Plex-Token`.
- [ ] **Step 2:** Write failing `http-server` tests (listen on port 0, fake deps): `/api/status` returns JSON with `no-store`; `/api/status?demo=tv` returns the demo; `/api/players` shape; `/img/zzz` → 404; `/img/<known>?w=999999` asks the fake client for width `1600`; `/../config.json` and `/%2e%2e/config.json` → 404; `/` returns HTML; `/manifest.webmanifest` has content type `application/manifest+json`.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement the four modules and the demo SVGs.
- [ ] **Step 5:** Run `npm test`. Expected: all PASS.
- [ ] **Step 6:** Run `node server.js` with no `config.json`. Expected: the config error and exit code 1.
- [ ] **Step 7:** Commit `feat: helper server, status endpoint, demo mode`.

### Task 9: Brand assets (logo, icons, fonts, manifest)

**Files:** Create `scripts/build-icons.js`, `public/icons/*`, `public/fonts/*`, `public/manifest.webmanifest`, `tests/icons.test.js`

**Interfaces:**
- Produces: `public/icons/logo.svg`, `icon-120.png`, `icon-152.png`, `icon-167.png`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `favicon-32.png`. Fonts `limelight-400`, `inter-400`, `inter-600`, `inter-700`, each as `.woff2` and `.woff`, plus `OFL.txt`.

The logo is defined once in `build-icons.js` as a list of shapes on a 512 grid: background rounded square `#14110F`; portrait amber `#FFC857` rounded rectangle (2:3); a geometric dark `#14110F` "P" (stem rectangle plus a ring-shaped bowl); 20 bulbs around the poster alternating `#FFE9A8` and `#7A5C1E`. The script writes the SVG from that list and rasterizes the same list to PNG with a small signed-distance renderer (4× supersampling) and a `zlib` PNG encoder. The maskable icon scales the art to 70% on a full-bleed background. No dependencies.

- [ ] **Step 1:** Write failing test: after `require('../scripts/build-icons.js').build(tmpDir)`, each PNG exists, starts with the PNG signature, and its IHDR width and height match its name; `logo.svg` contains `#FFC857` and 20 `<circle`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the script; run `npm run icons`; open `icon-512.png` and check it by eye.
- [ ] **Step 4:** Download the fonts (approved by the owner) from the Fontsource static files (latin subset, Limelight 400, Inter 400/600/700, `.woff2` and `.woff`) and the OFL text. Check each file is non-empty and starts with `wOF2` or `wOFF`.
- [ ] **Step 5:** Write `manifest.webmanifest`: `name` and `short_name` `PosterLight`, `description` `Now showing at home.`, `display` `fullscreen`, `orientation` `any`, `start_url` `./`, `background_color` and `theme_color` `#14110F`, icons 192, 512, and maskable 512.
- [ ] **Step 6:** Run `npm test`. Expected: PASS.
- [ ] **Step 7:** Commit `feat: logo, icons, fonts, manifest`.

### Task 10: Client view logic

**Files:** Create `public/js/logic.js`, `tests/logic.test.js`

**Interfaces:**
- Produces global `PosterLogic` (also `module.exports` under Node), ES5 only:
  - `computeView(status, ctx) -> { screen, overlay, card }` with `ctx = { nowMs, lastTapMs, hasPlayer }`.
    - `screen`: `'setup'` when `hasPlayer` is false; `'idle'` when `status` is null or `state 'idle'`; `'intermission'`; else `'now'`.
    - `awake = nowMs - lastTapMs < 30000`.
    - `overlay`: `'full'` when `status.brightness === 'full'` or `awake`; else `'fact'` when a fact is present (dim level with the card visible); else `'dim'`.
    - `card`: `'fact'` when a fact is present; else `'cast'` when overlay is `'full'` and the cast is not empty; else `'hidden'`. Always `'hidden'` for tracks and for screens other than `'now'`.
  - `computeLayout(w, h, posterShape) -> { orientation, posterW, posterH, castCount, baseFont }`.
    - `orientation` `'landscape'` when `w > h`, else `'portrait'`.
    - Poster ratio is 2:3 (`portrait`) or 1:1 (`square`). Portrait: the poster fits inside `0.86 w` by `0.52 h`. Landscape: inside `0.42 w` by `0.74 h`. Width and height are whole pixels and the ratio never changes.
    - `castCount`: free card width divided by one headshot cell (`96` px when `min(w, h) >= 600`, else `72` px), minimum 3, maximum 8.
    - `baseFont = clamp(min(w, h) / 40, 14, 26)`.
  - `pickPlayer(search, stored) -> String | null` — `?player=` wins over the stored value; empty → `null`.
  - `imageSize(cssPx, dpr) -> Number` — `Math.ceil(cssPx * Math.min(dpr || 1, 2) / 100) * 100`.

- [ ] **Step 1:** Write failing tests:
  - each `screen` case above.
  - dim status, no tap, no fact → `overlay 'dim'`, `card 'hidden'`.
  - dim status with fact → `overlay 'fact'`, `card 'fact'`.
  - dim status, tap 29999 ms ago → `overlay 'full'`, `card 'cast'`; tap 30000 ms ago → `'dim'`.
  - full status with fact → `card 'fact'`; full without fact → `card 'cast'`; full with empty cast → `'hidden'`.
  - track → `card 'hidden'`.
  - `computeLayout` for all eight sizes (768×1024, 1024×768, 800×1280, 1280×800, 390×844, 844×390, 360×800, 800×360): `posterW / posterH` within 1% of 2/3; the poster fits its box; `castCount` between 3 and 8; phones get a smaller `castCount` than tablets in portrait; square shape gives `posterW === posterH`.
  - `pickPlayer('?player=abc', 'def') === 'abc'`; `pickPlayer('', 'def') === 'def'`; `pickPlayer('', null) === null`.
  - `imageSize(384, 2) === 800`; `imageSize(384, 3) === 800`; `imageSize(384, undefined) === 400`.
  - the file text does not match `/=>|\blet\b|\bconst\b|\?\.|\?\?|`/`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: client view and layout logic`.

### Task 11: Web app UI

Use the `frontend-design` skill for the marquee look.

**Files:** Create `public/index.html`, `public/css/posterlight.css`, `public/js/app.js`, `tests/es5.test.js`

**Interfaces:**
- Consumes: `PosterLogic` (Task 10); `/api/status`, `/api/players`, `/img/<id>` (Task 8); fonts, icons, manifest (Task 9).

Requirements:
- `index.html` head: `viewport` with `viewport-fit=cover` and `user-scalable=no`; `apple-mobile-web-app-capable` `yes`; `mobile-web-app-capable` `yes`; `apple-mobile-web-app-status-bar-style` `black-translucent`; `apple-mobile-web-app-title` `PosterLight`; `theme-color` `#14110F`; `apple-touch-icon` links for 120, 152, 167, 180; manifest link; favicon.
- Four screens in one page, switched by class with opacity fades: setup, idle, now showing, intermission.
- **Setup:** logo, tagline, a button per player from `/api/players`, an `Any player` button, and a refresh every 5 s. The choice saves to `localStorage` key `posterlight.player` (wrapped in try/catch). A small gear in a corner, shown for 30 s after a tap, returns to setup.
- **Now showing:** `NOW SHOWING` in Limelight with a row of bulbs. The chase uses three overlapping bulb groups whose opacity steps in turn on a slow cycle (about 2.4 s). Poster in a lit frame (static gradient and border; no animated `box-shadow`). The poster wrapper drifts with a slow `transform` loop of a few pixels (about 240 s). Title, subtitle, rating badge, runtime (`1h 57m`). One bottom card holding either the fact (`Fact 3 of 15` label plus text) or the cast strip (round headshots, actor name, character name).
- **Poster fit:** `app.js` sets the poster's pixel width and height from `computeLayout` on `resize` and `orientationchange`. On an orientation change the stage fades out (200 ms), the layout class changes, and it fades in. No reload. Images use `object-fit: contain` inside the computed box, so nothing is ever cropped.
- **Dimming:** a fixed black overlay above everything, with `opacity` `0` (full), `0.55` (fact), `0.8` (dim) and a 2 s transition. In `fact` and `dim` modes the card and poster sit correctly because the card is raised above the overlay only for `fact`.
- **Intermission:** a retro sign, `INTERMISSION` in Limelight inside a bulb border, with the dim poster behind it.
- **Idle:** dark screen, faint `NO FEATURE PLAYING` marquee with bulbs at the dim color, slow drift.
- **Connection:** XHR with an 8 s timeout. On any failure keep the last screen and keep polling. After 3 failures in a row show a small dim dot in a corner; remove it on the next success. No touch needed.
- **Wake lock:** if `'wakeLock' in navigator`, request `screen` after the first tap and again on `visibilitychange` when visible. Ignore errors.
- **Tap:** a tap anywhere sets `lastTapMs`.
- **Safe areas:** padding uses `env(safe-area-inset-*)` inside `@supports (padding: env(safe-area-inset-top))`.
- **Images:** request `/img/<id>?w=&h=` using `imageSize`. Change the `src` only when the id changes. Fade a new poster in on `load`. A failed headshot shows the actor's initials.
- **CSS:** flexbox with margins (no `gap`); `-webkit-` prefixes where iOS 12 needs them; `@font-face` with `font-display: swap`; sizes in `em` from the `baseFont` set on the root element.
- `?demo=<name>` in the page URL passes through to `/api/status`.

- [ ] **Step 1:** Write failing `tests/es5.test.js`: `public/js/app.js` exists and does not match `/=>|\blet\b|\bconst\b|\?\.[a-zA-Z_]|\?\?|`|\bfetch\(|\basync\b|\bPromise\b/`; `posterlight.css` does not match `/\bgap\s*:|aspect-ratio/`; every `transition` and `@keyframes` block in the CSS names only `opacity` and `transform`; `index.html` contains each meta tag listed above.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Invoke `frontend-design`, then build the three files.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Start the helper and open `http://localhost:8686/?demo=movie` in the browser pane. Check each demo (`movie`, `movie-fact`, `movie-dim`, `tv`, `music`, `intermission`, `idle`) and the setup screen. The console must show no errors.
- [ ] **Step 6:** Commit `feat: marquee web app`.

### Task 12: Layout check at the eight sizes

Use `superpowers:systematic-debugging` for any browser quirk.

- [ ] **Step 1:** For each size (768×1024, 1024×768, 800×1280, 1280×800, 390×844, 844×390, 360×800, 800×360) and each of `?demo=movie`, `movie-fact`, `tv`, `music`, `intermission`, `idle`: take a screenshot and check: no scrollbars, no overlap, poster ratio correct (measure the element: width / height within 1% of 2/3, or 1 for music), title readable, cast count sensible.
- [ ] **Step 2:** Check rotation: change the size from portrait to landscape without a reload and confirm the layout switches.
- [ ] **Step 3:** Fix each problem with a failing `computeLayout` test first when the cause is layout math.
- [ ] **Step 4:** Commit `fix: layout adjustments from size checks` (skip if nothing changed).

### Task 13: Library script and fact files

**Files:** Create `scripts/list-library.js`, `tests/list-library.test.js`, `facts/movies/*.json`, `facts/shows/*.json`, `facts/README.md`

**Interfaces:**
- Consumes: `createPlexClient`, `parseLibraryItems`, `slugify`, `loadConfig`.
- Produces: `summarize(items, factsDir) -> { movies: [{ title, year, file, hasFacts }], shows: [...] }`. The CLI reads `/library/sections`, then `/library/sections/<key>/all` for each movie and show section, writes `data/library.json`, and prints the counts and every title with no fact file, with the file name to create.

- [ ] **Step 1:** Write failing test for `summarize` with two movies and one show, one of which has a fact file in a temp dir.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 3:** Ask the owner to fill in `config.json`. Run `npm run library`.
- [ ] **Step 4:** Write fact files for the listed titles: 20 or more facts per movie where that many can be stated with confidence, 12 or more per show. Each fact is one or two sentences, 200 characters at most, about the production, cast, release, or awards. Leave out anything uncertain; a short file is correct. A title with too few sure facts gets no file and uses the fallback. `facts/README.md` explains the format and how to add a title.
- [ ] **Step 5:** Add a test that every file under `facts/` parses, has a non-empty `title`, a `facts` array of non-empty strings each 200 characters or fewer, no duplicates, and a file name equal to its slug rule.
- [ ] **Step 6:** Run `npm test`. Expected: PASS. Commit `feat: library script and fact files`.

### Task 14: README

Use the `engineering:documentation` skill. Plain language, numbered steps, one action per step.

**Files:** Create `README.md`

Sections: what PosterLight is; what you need; **Install the helper on Windows** (install Node.js LTS, copy the folder, copy `config.example.json` to `config.json`, find the PC's IP address, `npm start`, allow the port through Windows Firewall, start at sign-in with Task Scheduler); short notes for Mac, Linux, and NAS; **Find your Plex token** (Plex Web → an item → `⋯` → Get Info → View XML → copy the `X-Plex-Token` value from the address bar); **Set up a device**: one section each for iPad and iPhone (Safari → Share → Add to Home Screen; Settings → Display & Brightness → Auto-Lock → Never; Guided Access as an option; keep it on power), Android (Chrome → menu → Add to Home screen / Install app; wake lock is automatic; Developer options → Stay awake while charging as a backup), Fire tablet (Silk → menu → Add to Home Screen; Display → Sleep → longest value, or Developer options → Stay awake); choose a player, including `?player=`; add facts for new titles (`npm run library`); **Check it on real devices** (the demo URLs and what to look for at each state); troubleshooting; tests (`npm test`); fonts license.

- [ ] **Step 1:** Write the README.
- [ ] **Step 2:** Run every command in it that can run on this Mac and confirm the result matches the text.
- [ ] **Step 3:** Commit `docs: setup guide`.

### Task 15: Final verification

Use `superpowers:verification-before-completion`.

- [ ] **Step 1:** Run `npm test`. Expected: all pass. Record the count.
- [ ] **Step 2:** With the owner's `config.json` in place, start the helper, play a movie, and confirm: the player appears in setup; poster, title, rating, runtime, and cast are right; pausing for 10 s shows Intermission; stopping shows the idle screen.
- [ ] **Step 3:** Search all served responses and the logs for the token value. Expected: no match.
- [ ] **Step 4:** Stop the helper while a device shows a movie. Confirm the screen stays. Start the helper. Confirm it reconnects with no touch.
- [ ] **Step 5:** Go through each spec section and mark it done, or name what is not done and why.
- [ ] **Step 6:** Report to the owner: files created, test results, what was checked live, what could not be checked without real hardware (iOS 12 Safari, Silk), and how to check it.

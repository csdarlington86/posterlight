# PosterLight Spec

Source: the owner's request of 2026-11-13, copied without change, plus the
answers the owner gave the same day.

## Owner answers (2026-11-13)

- The Plex server runs on a **Windows PC**. Write the helper install steps for Windows first.
- Download Limelight and Inter (SIL Open Font License) into the project: **approved**.
- Local git repository with a commit per task, no remote, no push: **approved**.
- The development Mac can reach the Plex server now. The owner puts the Plex address and token in a local config file, never in chat.

## Request

Build "PosterLight": a web app that turns spare tablets and phones
into a theater poster case showing whatever is playing on my Plex
server. Write the plan first, then build it.

### Devices
- Must work on: iPad Air 1 (iOS 12.5 Safari, the oldest target),
  newer iPads, iPhones, Android tablets and phones (Chrome), and
  Amazon Fire tablets (Silk browser).
- One codebase. Write for the oldest browser first, then add
  extras only behind feature detection.

### Architecture
- A small Node.js helper server that runs on any always-on computer
  (Windows, Mac, Linux, or NAS).
- The helper polls Plex (/status/sessions) and serves the web page
  plus a simple JSON status endpoint. The Plex token stays on the
  helper and never reaches a device. Poster and cast images are
  proxied through the helper and resized to fit each device's
  screen, so old devices don't run out of memory.
- Each device opens the page in its browser and saves it to the
  home screen as a full-screen web app. Include the iOS meta tags,
  a touch icon, and a web app manifest for Android.
- Each device can choose which Plex player to follow, from a simple
  first-run setup screen. The choice is remembered on that device
  and can also be set with a URL parameter.
- No paid APIs or AI services at runtime.

### Browser rules
- Baseline is iOS 12 Safari: plain ES5-style JavaScript with no
  build step, no optional chaining, no nullish coalescing, no
  flexbox gap, no aspect-ratio, no ResizeObserver.
- Bundle fonts locally. Do not depend on a CDN.
- Animate only transform and opacity so old chips stay cool.
- Keep the screen awake with the Screen Wake Lock API where the
  browser supports it. Where it doesn't, the setup guide covers
  the device setting.
- Respect notches and rounded corners with safe-area insets.
- The web cannot change hardware brightness, so "dimming" is a
  dark overlay.

### Layout
- Fluid, not fixed to one screen size. It must look right on 4:3
  tablets, 16:10 tablets, and tall phones, in both orientations.
- Portrait: poster on top, card below. Landscape: poster left,
  info right. The layout switches on rotation with a soft fade and
  no reload.
- Phones: same design scaled down, with fewer cast headshots and
  text that stays readable from across a room.
- The poster always keeps its shape and is never cropped.

### Screen: Now Showing
- "NOW SHOWING" marquee header with slow chasing bulbs.
- Poster in a lit frame, with a slow drift to prevent burn-in.
- Title, rating badge, runtime.
- One shared bottom card for facts and the cast strip (actor
  headshots with character names).

### Facts
- Movies: 15 facts spread evenly across the runtime, no repeats.
- TV: 3 facts per episode, spread evenly, drawn from a per-show pool
  with none reused until the pool runs out.
- Between facts, the card shows the cast strip or stays empty.
- Fact timing comes from the helper, so every device following the
  same player shows the same fact at the same moment.
- Source: pre-written JSON files, one per movie and one per show.
  Include a script that lists my Plex library so you (Claude Code)
  can write the fact files, and that I can re-run when I add titles.
  Facts must be real and verifiable. Skip anything you're unsure of.
- Fallback when a title has no file: facts built from Plex's own
  data (year, director, cast, studio, other titles in my library).

### Brightness
- Full brightness for the first 3 minutes of playback, then dim to
  a soft poster glow with the card hidden.
- Each new fact fades in softly at dim level for about 60 seconds,
  then hides.
- Tapping the screen wakes it to full for 30 seconds.

### Other states
- Paused for more than 10 seconds: a retro "Intermission" sign.
- Nothing playing: dark screen with a faint "No Feature Playing"
  marquee.
- TV: season art. Music: album art, no facts.
- Lost Wi-Fi or Plex: keep the last screen and reconnect without
  any touch.

### Brand
- Name: PosterLight. Tagline: "Now showing at home."
- Colors: background #14110F, amber #FFC857, cream #F6EFE2, bright
  bulb #FFE9A8, dim bulb #7A5C1E.
- Display font: Limelight. Body font: Inter.
- Logo mark: a portrait amber poster with a dark "P" on it, ringed
  by marquee bulbs alternating bright and dim. Recreate it as an SVG
  and export the icon sizes iOS and Android need.

### Deliverables
- Working helper server and web app.
- Tests for fact scheduling, the state changes (playing, paused,
  idle), and Plex response parsing.
- A plain-language README: install the helper, find my Plex token,
  and a short section per device type (iPad and iPhone, Android,
  Fire tablet) covering how to add it to the home screen and which
  settings keep the screen on.

Test the layout at these sizes in both orientations: 768x1024
(old iPad), 800x1280 (Fire and Android tablets), 390x844 (iPhone),
360x800 (Android phone). Tell me how to check it on real devices.

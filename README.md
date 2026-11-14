# PosterLight

**Now showing at home.**

PosterLight turns a spare tablet or phone into a theater poster case. It shows the poster,
title, cast, and facts for whatever is playing on your Plex server.

![PosterLight on a tablet in landscape: a lit NOW SHOWING marquee, a framed poster, the title, and a cast strip](docs/screenshot.jpg)

*The demo screen. The poster, title, and people in it are made up.*

## Two ways to use it

**1. The web app: nothing to install.** Open **<https://csdarlington86.github.io/posterlight/app/>** on the tablet or phone.
The screen shows a short code. Go to `plex.tv/link` on your phone or computer, sign in, and type the code. That is all.
You can [see a demo first](https://csdarlington86.github.io/posterlight/demo/).

**2. The helper: runs in your home.** A small program on a computer that stays on. Your tablets then need no sign-in,
and it works when a router blocks Plex's secure home addresses. The rest of this guide covers the helper.

| | Web app | Helper |
| --- | --- | --- |
| Install | Nothing | Node.js and this download |
| Sign in to Plex | Once on each screen | Once, on the helper computer |
| Where the Plex sign-in is kept | In the browser of each screen | On the helper computer only |
| Needs Plex secure connections (the default) | Yes | No |
| "Also in your library" facts | No | Yes |

Both need the Plex account that owns the server, because Plex shows "what is playing" to the owner only.

## The helper

It has two parts:

- **The helper.** A small program that runs on a computer in your home that stays on. It asks Plex what is playing.
- **The page.** Each tablet or phone opens one web page from the helper. You save it to the home screen.

Your Plex token stays on your own helper computer. It is never sent to a tablet or phone.

PosterLight is free and open source (MIT license).

## Contents

1. [What you need](#what-you-need)
1. [Quick start](#quick-start)
2. [Install the helper](#install-the-helper)
3. [Connect to Plex](#connect-to-plex)
4. [Set up a device](#set-up-a-device)
5. [Choose which player a screen follows](#choose-which-player-a-screen-follows)
6. [Facts](#facts)
7. [Check it on real devices](#check-it-on-real-devices)
8. [What the screen does](#what-the-screen-does)
9. [If something is wrong](#if-something-is-wrong)
10. [Privacy and safety](#privacy-and-safety)
11. [For developers](#for-developers)

## What you need

- A **Plex Media Server** that you can sign in to.
- A **computer that stays on**, on the same home network: Windows, Mac, Linux, or a NAS. The Plex computer itself is a good choice.
- **Node.js 18 or later** on that computer. It is free, from <https://nodejs.org>.
- A **spare tablet or phone** on the same Wi-Fi. An old iPad works: iOS 12 or later.

You do not need a paid service, an account with PosterLight, or any programming.

## Quick start

1. Install [Node.js](https://nodejs.org) (the **LTS** version) on the computer that stays on.
2. Download PosterLight and unzip it.
3. Double-click `start-windows.bat` on Windows, or `start-mac.command` on a Mac.
4. A browser page opens. Click **Sign in with Plex** and sign in.
5. On your tablet, open the address the PosterLight window shows, for example `http://192.168.1.20:8686`.
6. Add the page to the tablet's home screen. See [Set up a device](#set-up-a-device).

PosterLight is free and has nothing else to install. There is no `npm install` step.

## Install the helper

The helper is the same on every system. It needs Node.js 18 or later.
The Plex computer itself is a good place to run it.

### Windows

1. Install Node.js. Go to <https://nodejs.org>, download the **LTS** installer, and run it with the default options.
2. Unzip PosterLight to a short path, for example `C:\PosterLight`.
3. Double-click `start-windows.bat`.
4. If Windows asks about the firewall, select **Private networks** and click **Allow access**.

Keep the window open. The helper stops when you close it.

**If Windows did not ask about the firewall**, devices cannot reach the helper until you allow port 8686:

1. Open the Start menu, type `cmd`, right-click **Command Prompt**, and click **Run as administrator**.
2. Run this command. It lets other devices on your network reach port 8686.

   ```bash
   netsh advfirewall firewall add rule name="PosterLight" dir=in action=allow protocol=TCP localport=8686
   ```

**To start the helper when you sign in to Windows:**

1. Open the Start menu, type `Task Scheduler`, and open it.
2. Click **Create Basic Task**. Name it `PosterLight`. Click **Next**.
3. Select **When I log on**. Click **Next**.
4. Select **Start a program**. Click **Next**.
5. In **Program/script**, type `node`.
6. In **Add arguments**, type `server.js`.
7. In **Start in**, type the folder path, for example `C:\PosterLight`.
8. Click **Next**, then **Finish**.

### Mac

1. Install Node.js from <https://nodejs.org> (the **LTS** version).
2. Unzip PosterLight.
3. Double-click `start-mac.command`. If macOS blocks it, right-click the file and click **Open**.

To start it at login, add `start-mac.command` in **System Settings > General > Login Items**.

### Linux

1. Install Node.js 18 or later with your package manager.
2. Start the helper in the PosterLight folder:

   ```bash
   npm start
   ```

To run it as a service, create a `systemd` unit with `WorkingDirectory` set to the folder and `ExecStart=/usr/bin/node server.js`.

### Docker and NAS (Synology, QNAP, Unraid)

1. Build and start the container in the PosterLight folder:

   ```bash
   docker compose up -d
   ```

2. Read the setup code from the log:

   ```bash
   docker compose logs posterlight
   ```

3. Open `http://<address of the Docker computer>:8686/setup` and type the setup code.

Settings are kept in the `posterlight-data` volume, so they survive an update.

### Give the helper computer a fixed address

Your devices save the helper's address. If that address changes, the devices lose the helper.
Reserve the computer's IP address in your router (often called "DHCP reservation" or "static lease").

## Connect to Plex

The first time the helper starts, it is not connected to Plex. It shows a setup address in its window.

### Sign in with Plex (the easy way)

1. On the helper computer, open `http://localhost:8686/setup` in a web browser. The starter files open it for you.
2. Click **Sign in with Plex**. A Plex page opens in a new tab.
3. Sign in on the Plex page. PosterLight never sees your password.
4. Go back to the setup tab. If you have more than one Plex server, click the one to follow.
5. The page says **PosterLight is connected**.

The helper starts at once. You do not need to restart it.

### Set up from another device

Use this when the helper computer has no screen, such as a NAS.

1. Open `http://<helper address>:8686/setup` on a phone or laptop.
2. Type the 6-digit setup code from the PosterLight window (or the Docker log).
3. Continue with **Sign in with Plex**.

The code is new each time the helper starts.

### Enter the address and token by hand

On the setup page, click **Enter the address and token by hand instead**. To find your token:

1. Open Plex in a web browser and open any movie or episode.
2. Click the `⋯` button, then **Get Info**, then **View XML**. A new tab opens.
3. In the address bar of the new tab, copy the letters and numbers after `X-Plex-Token=`.

You can also skip the setup page and write the settings yourself. Copy `config.example.json` to `config.json`
and fill it in. Or use environment variables: `.env.example` lists them and shows how to start with them.

### Connect to a different server later

Open `http://localhost:8686/setup` on the helper computer and click **Connect to a different server**.

## Set up a device

Do these steps on each tablet or phone. Use the address the PosterLight window shows, for example `http://192.168.1.20:8686`.

Keep the device on its charger. A poster case is on for hours.

### iPad and iPhone

Works on iOS 12 and later, which includes the iPad Air 1.

1. Open **Safari**. Other browsers on iOS cannot add a full-screen web app.
2. Go to the helper address.
3. Tap the **Share** button (the square with an arrow).
4. Tap **Add to Home Screen**, then tap **Add**.
5. Open **PosterLight** from the home screen. It opens full screen.

Keep the screen on:

1. Open **Settings**.
2. Tap **Display & Brightness**.
3. Tap **Auto-Lock**.
4. Tap **Never**.

Older iPads and iPhones cannot keep the screen on from a web page, so this setting is required there.
If **Never** is missing, turn off Low Power Mode in **Settings > Battery**.

Optional: **Guided Access** locks the device to PosterLight so a stray touch cannot leave it.
Find it in **Settings > Accessibility > Guided Access** (on iOS 12: **Settings > General > Accessibility > Guided Access**).

### Android tablet and phone

1. Open **Chrome**.
2. Go to the helper address.
3. Tap the `⋮` menu.
4. Tap **Add to Home screen**, then tap **Add**.
5. Open **PosterLight** from the home screen.

Keep the screen on:

1. Open **Settings > About phone** (or **About tablet**).
2. Tap **Build number** 7 times. This turns on Developer options.
3. Open **Settings > System > Developer options**.
4. Turn on **Stay awake**. The screen now stays on while the device charges.

**Good to know.** Chrome only gives two extras to pages it calls "secure", and a plain home-network
address like `http://192.168.1.20:8686` is not one of them:

- the automatic keep-awake (Screen Wake Lock), and
- opening with no address bar.

PosterLight works without them. **Stay awake** covers the first one. If you want both extras:

1. In Chrome, go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Type the helper address in the box, for example `http://192.168.1.20:8686`.
3. Change the setting to **Enabled** and tap **Relaunch**.
4. Remove the old home screen icon. Add it again with `⋮` > **Add to Home screen** > **Install**.

### Amazon Fire tablet

1. Open the **Silk** browser.
2. Go to the helper address.
3. Tap the menu button.
4. Tap **Add to Home Screen** if your version of Silk shows it. If it does not, tap the bookmark icon to save the page.
5. Open the page.

Keep the screen on:

1. Open **Settings > Display > Display Sleep** (called **Sleep** on some models).
2. Select **Never** if it is there. If not, select the longest time, then do the next steps.
3. Open **Settings > Device Options > About Fire Tablet**.
4. Tap **Serial Number** 7 times. This turns on Developer Options.
5. Go back to **Device Options**, open **Developer Options**, and turn on **Stay awake**.

Silk shows its address bar on a home-network page. If you want a true full-screen poster on a Fire
tablet, a kiosk browser app from the Amazon Appstore can show the same address full screen.

## Choose which player a screen follows

The first time you open PosterLight, it asks which Plex player this screen follows.

1. Start something playing in Plex. The player appears in the list within 5 seconds.
2. Tap the player. Or tap **Any player** to show whatever is playing.

The device remembers the choice.

To change it later:

1. Tap the screen.
2. Tap **Change player** in the top right corner. The button shows for 30 seconds after a tap.

You can also set the player in the address. Use the player's name as Plex shows it:

```
http://192.168.1.20:8686/?player=Living Room
```

## Facts

Facts come from a shared fact pack: the files in the `facts` folder, one per movie and one per show.
Anyone can add a title or fix a fact. See [CONTRIBUTING.md](CONTRIBUTING.md) and [facts/README.md](facts/README.md).

- A movie shows up to 15 facts, spread evenly across its runtime.
- An episode shows 3 facts from its show's file. A fact is not reused until every fact in the file has been shown.
- A title with no file shows simple facts from Plex: year, director, cast, studio, and other titles in your library.
- Music shows album art and no facts.

### Add facts for new titles

1. List your library. This reads your Plex library and changes nothing on the server.

   ```bash
   npm run library
   ```

2. Read the output. It lists each title with no fact file and the file name to create.
3. Create the files. Please share them with a pull request, so every PosterLight user gets them.
4. Check the files:

   ```bash
   npm test
   ```

The helper reads fact files again every minute. You do not need to restart it.

## Check it on real devices

PosterLight has a demo mode. It shows each screen without playing anything. Add `?demo=` and a name to the address:

| Address ending | What you should see |
| --- | --- |
| `/?demo=movie` | Full brightness. Marquee with chasing bulbs, poster, title, rating, runtime, cast strip. |
| `/?demo=movie-fact` | Soft dim level. The card shows a fact. |
| `/?demo=movie-dim` | Dim poster glow. The card is hidden. |
| `/?demo=movie-long` | A very long title. It must stay inside the screen. |
| `/?demo=tv` | Show title, season and episode line, season art. |
| `/?demo=music` | Square album art, no card. |
| `/?demo=intermission` | The Intermission sign. |
| `/?demo=idle` | A faint "No Feature Playing" sign. |

On each device:

1. Open `/?demo=movie`. Check that the bulbs chase, the poster is not cropped, and nothing overlaps.
2. Rotate the device. The layout fades and switches: poster on top in portrait, poster on the left in landscape. The page does not reload.
3. Open `/?demo=movie-dim`. Tap the screen. It brightens, and dims again after 30 seconds.
4. Open the page from the home screen icon. Check that it fills the screen and stays clear of the notch and rounded corners.
5. Leave it for 10 minutes. Check that the screen stays on.

Then check a real movie:

1. Open the page with no `?demo=`. Play a movie on the player this device follows.
2. The poster appears within a few seconds, at full brightness.
3. Pause for more than 10 seconds. The Intermission sign appears. Press play. The poster returns.
4. After 3 minutes of playback the screen dims.
5. Stop the movie. The "No Feature Playing" sign appears.
6. Turn the device's Wi-Fi off for a minute during a movie, then on again. The screen stays as it was and catches up with no touch. A small dim dot in the bottom left corner shows while the connection is lost.

### What was tested, and what was not

- Tested in a desktop browser at 768×1024, 800×1280, 390×844, and 360×800, in both orientations, for every demo screen.
- The code that the poster page runs is checked by tests to use only features that iOS 12 Safari has.
- Setup was tested from start to finish against stand-ins for plex.tv and a Plex server.
- **Not yet tested:** iOS 12 Safari on a real iPad Air 1, Silk on a real Fire tablet, sign-in against the real plex.tv, and the Docker build. Reports from real devices are very welcome.

## What the screen does

- **First 3 minutes of a title:** full brightness, with the cast strip.
- **After that:** a dim poster glow. The web cannot change a screen's real brightness, so "dim" is a dark layer over the page.
- **When a fact is due:** the fact fades in softly for about 60 seconds, then hides.
- **Tap:** full brightness for 30 seconds.
- **Paused for more than 10 seconds:** the Intermission sign.
- **Nothing playing:** a faint "No Feature Playing" sign.
- Everything drifts a few pixels over 4 minutes, so nothing burns into the screen.

Every device that follows the same player shows the same fact. Devices ask the helper every 2 seconds, so two screens can differ by up to 2 seconds.

## If something is wrong

| Problem | What to do |
| --- | --- |
| The screen says "PosterLight is not connected to Plex yet" | Finish [Connect to Plex](#connect-to-plex). |
| The setup page says the helper could not reach the server | Check that Plex Media Server is running. Then use **Enter the address and token by hand**. |
| The setup page asks for a code | You opened it from another device. The code is in the PosterLight window. |
| "Too many wrong codes" | Restart the helper. It prints a new code. |
| The helper prints `Plex is not reachable` | Plex is off, or its address changed. Run setup again. |
| The helper prints `Plex answered 401` | The token is no longer valid. Run setup again. |
| The helper prints `port 8686 is already in use` | Close the other copy of the helper. Or set `"port"` in `config.json`. |
| A device cannot open the page | Check that the device is on the same Wi-Fi. Check the firewall step for your system. |
| The player list is empty | Start something playing in Plex. Or tap **Any player**. |
| The poster is missing but the title shows | Open `http://<helper address>/healthz`. `"plexOk": true` means the helper reaches Plex. |
| A title shows only simple facts | It has no fact file yet. See [Facts](#facts). |
| The screen turns off | Follow the "Keep the screen on" steps for that device. |
| The screen shows an old title after Plex went offline | The helper keeps the last screen until the title's runtime ends, then shows the idle sign. |

## Privacy and safety

- Your Plex token stays in `config.json` on your own helper computer. It is never sent to a tablet or phone.
- PosterLight has no server of its own. The project receives nothing from your installation.
- The helper talks only to your Plex server, and to plex.tv while you sign in.
- The helper has no password. Keep it on your home network. Do not forward its port on your router.

More detail is in [SECURITY.md](SECURITY.md).

PosterLight is a community project. It is not affiliated with, endorsed by, or sponsored by Plex, Inc.
"Plex" is a trademark of Plex, Inc.

PosterLight does not use the TMDB, IMDb, or TVDB services. Posters and cast photos come only from your own
Plex server. The repository ships no real poster images: the demo art is made up.

## For developers

```bash
npm test
```

Runs all tests with Node's built-in test runner. There are no dependencies to install.

| Path | What it is |
| --- | --- |
| `server.js` | Starts the helper: Plex polling and the web server. |
| `lib/plex-parser.js` | Turns Plex responses into plain objects. |
| `lib/session-tracker.js` | Playing, paused, intermission, idle, and brightness, per player. |
| `lib/fact-scheduler.js` | Where in a title each fact appears. |
| `lib/fact-store.js` | Reads fact files and picks facts with no repeats. |
| `lib/fallback-facts.js` | Facts from Plex data for titles with no file. |
| `lib/plex-client.js` | The only code that holds the Plex token. |
| `lib/plex-account.js` | "Sign in with Plex" against plex.tv. |
| `lib/setup.js` | The setup steps, and the rules for who may use them. |
| `lib/http-server.js` | The page, `/api/status`, `/api/players`, `/img/<id>`. |
| `public/` | The page. Plain ES5 JavaScript with no build step, for iOS 12 Safari. |
| `scripts/list-library.js` | `npm run library`. |
| `scripts/build-icons.js` | `npm run icons`. Draws the logo and writes the SVG and PNG icons. |
| `lib/web-engine.js`, `lib/web-connect.js` | The web app's engine and Plex sign-in. They run in the browser and reuse the helper's modules. |
| `site/`, `scripts/build-site.js` | The public website: landing page, web app, and demo. |
| `.github/workflows/pages.yml` | Tests, builds, and publishes the website on every push to `main`. |
| `docs/superpowers/` | The spec and the implementation plans. |
| `Dockerfile`, `docker-compose.yml` | The container image. |

Images never come straight from Plex. A device asks the helper for `/img/<id>` at the size of its
screen, and the helper asks Plex's own image resizer. An old tablet never loads a full-size poster.

### Updating the live website

The website publishes itself. Change a file, commit, and push to `main` (or edit a file on github.com and commit there).
GitHub runs the tests, builds the site, and puts it live in about two minutes. If a test fails, the old version stays live.

To build the site on your own computer and look at it first:

```bash
npm run site
```

That writes the `_site` folder. It is not committed.

### Fonts

Limelight and Inter are bundled in `public/fonts`. Both use the SIL Open Font License.
The license texts are in `public/fonts/OFL-Limelight.txt` and `public/fonts/OFL-Inter.txt`.

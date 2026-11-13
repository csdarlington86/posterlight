# PosterLight

**Now showing at home.**

PosterLight turns a spare tablet or phone into a theater poster case. It shows the poster,
title, cast, and facts for whatever is playing on your Plex server.

It has two parts:

- **The helper.** A small program that runs on an always-on computer. It asks Plex what is playing.
- **The page.** Each tablet or phone opens one web page from the helper. You save it to the home screen.

Your Plex token stays on the helper. It is never sent to a tablet or phone.

## Contents

1. [What you need](#what-you-need)
2. [Install the helper on Windows](#install-the-helper-on-windows)
3. [Find your Plex token](#find-your-plex-token)
4. [Set up a device](#set-up-a-device)
5. [Choose which player a screen follows](#choose-which-player-a-screen-follows)
6. [Facts](#facts)
7. [Check it on real devices](#check-it-on-real-devices)
8. [What the screen does](#what-the-screen-does)
9. [If something is wrong](#if-something-is-wrong)
10. [Other computers: Mac, Linux, NAS](#other-computers-mac-linux-nas)
11. [For developers](#for-developers)

## What you need

- A Plex Media Server.
- A computer that stays on, on the same network. The Plex PC itself is a good choice.
- [Node.js](https://nodejs.org) version 18 or later on that computer. PosterLight needs nothing else. There is no `npm install` step.
- One or more tablets or phones on the same Wi-Fi.

## Install the helper on Windows

1. Install Node.js. Go to <https://nodejs.org>, download the **LTS** installer, and run it with the default options.
2. Copy the `PosterLight App` folder to the PC. A short path is easiest, for example `C:\PosterLight`.
3. Open the folder in File Explorer.
4. Copy `config.example.json` and name the copy `config.json`.
5. Open `config.json` in Notepad.
6. Set `plexUrl` to your Plex address. If the helper runs on the Plex PC, use `http://127.0.0.1:32400`.
7. Set `plexToken` to your Plex token. See [Find your Plex token](#find-your-plex-token).
8. Save the file. It looks like this:

   ```json
   {
     "plexUrl": "http://127.0.0.1:32400",
     "plexToken": "your-token-here",
     "port": 8686
   }
   ```

9. Click the address bar of the File Explorer window, type `cmd`, and press Enter. A command window opens in the folder.
10. Start the helper:

    ```bash
    npm start
    ```

11. Read the output. It shows the address for your devices, for example:

    ```
    PosterLight is running. Open http://192.168.1.20:8686 on your device.
    Connected to Plex.
    ```

12. If Windows asks about the firewall, select **Private networks** and click **Allow access**.

Keep the command window open. The helper stops when you close it.

### If Windows did not ask about the firewall

Devices cannot reach the helper until Windows allows port 8686.

1. Open the Start menu, type `cmd`, right-click **Command Prompt**, and click **Run as administrator**.
2. Run this command. It allows other devices on your network to reach port 8686.

   ```bash
   netsh advfirewall firewall add rule name="PosterLight" dir=in action=allow protocol=TCP localport=8686
   ```

### Start the helper when you sign in to Windows

1. Open the Start menu, type `Task Scheduler`, and open it.
2. Click **Create Basic Task**.
3. Name it `PosterLight`. Click **Next**.
4. Select **When I log on**. Click **Next**.
5. Select **Start a program**. Click **Next**.
6. In **Program/script**, type `node`.
7. In **Add arguments**, type `server.js`.
8. In **Start in**, type the folder path, for example `C:\PosterLight`.
9. Click **Next**, then **Finish**.

### Give the PC a fixed address

Your devices save the helper's address. If the PC's address changes, the devices lose the helper.
Reserve the PC's IP address in your router (often called "DHCP reservation" or "static lease").

## Find your Plex token

1. Open Plex in a web browser and sign in.
2. Open any movie or episode.
3. Click the `⋯` button, then click **Get Info**.
4. Click **View XML**. A new tab opens.
5. Look at the address bar of the new tab. Near the end you see `X-Plex-Token=` followed by letters and numbers.
6. Copy only the letters and numbers after `X-Plex-Token=`. That is your token.
7. Paste it into `config.json` as `plexToken`.

Keep the token private. Anyone who has it can use your Plex server.

## Set up a device

Do these steps on each tablet or phone. Use the address the helper printed, for example `http://192.168.1.20:8686`.

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

Facts come from files in the `facts` folder: one file per movie and one per show.
See [facts/README.md](facts/README.md) for the format.

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
3. Create the files. You can ask Claude Code to write them from `data/library.json`.
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
- The code that browsers run is checked by tests to use only features that iOS 12 Safari has.
- **Not tested on real hardware:** iOS 12 Safari on an iPad Air 1, and Silk on a Fire tablet. Please run the checks above on those devices.

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
| The helper prints `plexUrl is missing` or `plexToken is missing` | Create `config.json` from `config.example.json` and fill in both values. |
| The helper prints `Plex is not reachable` | Check `plexUrl`. Open that address plus `/web` in a browser on the helper PC. |
| The helper prints `Plex answered 401` | The token is wrong. Copy it again. |
| The helper prints `port 8686 is already in use` | Change `port` in `config.json`, or close the other copy of the helper. |
| A device cannot open the page | Check that the device is on the same Wi-Fi. Check the Windows firewall step. |
| The player list is empty | Start something playing in Plex. Or tap **Any player**. |
| The poster is missing but the title shows | Open `http://<helper address>/healthz`. `"plexOk": true` means the helper reaches Plex. |
| No fact file is used for a title | Run `npm run library` and compare the file name it prints with your file's name. |
| The screen turns off | Follow the "Keep the screen on" steps for that device. |
| The screen shows an old title after Plex went offline | The helper keeps the last screen until the title's runtime ends, then shows the idle sign. |

## Other computers: Mac, Linux, NAS

The helper is the same on every system: install Node.js 18 or later, create `config.json`, and run `npm start` in the folder.

- **Mac:** install Node.js from <https://nodejs.org>. Run `npm start` in Terminal. To start at login, add a small script to **System Settings > General > Login Items**.
- **Linux:** install Node.js with your package manager. Run the helper as a `systemd` service with `WorkingDirectory` set to the folder and `ExecStart=/usr/bin/node server.js`.
- **NAS:** use the Node.js package for your NAS (Synology, QNAP) or a `node:lts` Docker container with the folder mounted and port 8686 published.

You can also set the values with environment variables instead of `config.json`: `PLEX_URL`, `PLEX_TOKEN`, and `PORT`.

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
| `lib/http-server.js` | The page, `/api/status`, `/api/players`, `/img/<id>`. |
| `public/` | The page. Plain ES5 JavaScript with no build step, for iOS 12 Safari. |
| `scripts/list-library.js` | `npm run library`. |
| `scripts/build-icons.js` | `npm run icons`. Draws the logo and writes the SVG and PNG icons. |
| `docs/superpowers/` | The spec and the implementation plan. |

Images never come straight from Plex. A device asks the helper for `/img/<id>` at the size of its
screen, and the helper asks Plex's own image resizer. An old tablet never loads a full-size poster.

### Fonts

Limelight and Inter are bundled in `public/fonts`. Both use the SIL Open Font License.
The license texts are in `public/fonts/OFL-Limelight.txt` and `public/fonts/OFL-Inter.txt`.

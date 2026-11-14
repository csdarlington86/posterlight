# Security

## How PosterLight handles your Plex token

- Your token is stored in `config.json` on the computer that runs the helper. Nowhere else.
- The helper sends the token only to your own Plex server, and to plex.tv during "Sign in with Plex".
- The token is never sent to a tablet or phone, never written to the log, and never put in a web address.
- PosterLight has no server of its own. The project never receives anything from your installation.

## The web app

The web app at `csdarlington86.github.io/posterlight/app/` has no helper. The page itself talks to your Plex server.

- Your Plex sign-in token is saved in that browser on that device (`localStorage`), and nowhere else.
- The page sends it only to your own Plex server and to plex.tv. Poster and cast images are loaded from your own
  server with the token in the image address, because an image cannot carry a header.
- The website is static files on GitHub Pages. It has no server code and receives nothing from you.
- It loads no scripts, fonts, or trackers from any other site.
- Anyone who can use that device's browser can use that sign-in. To remove it, open the app's connect page and
  tap **Disconnect this screen from Plex**, or sign the device out at `plex.tv` under Authorized Devices.
- If you prefer that no token is ever stored on a tablet, use the helper.

## Keep the helper on your home network

The helper has no accounts or passwords. Anyone who can reach it can see what is playing.
Do not forward its port on your router and do not put it on the public internet.

## Setup is protected

Changing the Plex settings works only from the helper computer itself, or from another device that
knows the 6-digit setup code shown in the helper window. Ten wrong codes lock code entry until the helper restarts.

## Report a security problem

Please do not open a public issue for a security problem. Use the repository's
**Security > Report a vulnerability** page, so it can be fixed before it is public.

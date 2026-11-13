# Security

## How PosterLight handles your Plex token

- Your token is stored in `config.json` on the computer that runs the helper. Nowhere else.
- The helper sends the token only to your own Plex server, and to plex.tv during "Sign in with Plex".
- The token is never sent to a tablet or phone, never written to the log, and never put in a web address.
- PosterLight has no server of its own. The project never receives anything from your installation.

## Keep the helper on your home network

The helper has no accounts or passwords. Anyone who can reach it can see what is playing.
Do not forward its port on your router and do not put it on the public internet.

## Setup is protected

Changing the Plex settings works only from the helper computer itself, or from another device that
knows the 6-digit setup code shown in the helper window. Ten wrong codes lock code entry until the helper restarts.

## Report a security problem

Please do not open a public issue for a security problem. Use the repository's
**Security > Report a vulnerability** page, so it can be fixed before it is public.

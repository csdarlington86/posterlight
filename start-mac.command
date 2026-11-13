#!/bin/sh
# PosterLight starter for Mac. Double-click this file.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "PosterLight needs Node.js. Install the LTS version from https://nodejs.org and run this file again."
  exit 1
fi
if [ ! -f config.json ]; then
  (sleep 2 && open "http://localhost:8686/setup") &
fi
node server.js

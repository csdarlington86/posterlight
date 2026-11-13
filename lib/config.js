'use strict';
// Loads the helper settings. Environment variables win over config.json.
var fs = require('fs');

var PLACEHOLDER = 'PUT-TOKEN-HERE';
var DEFAULT_PORT = 8686;

function readFile(filePath) {
  var text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return {};
  }
  try {
    return JSON.parse(text) || {};
  } catch (e) {
    throw new Error('config.json is not valid JSON. Check for a missing quote or comma.');
  }
}

function loadConfig(filePath, env) {
  env = env || {};
  var file = readFile(filePath);
  var plexUrl = String(env.PLEX_URL || file.plexUrl || '').trim().replace(/\/+$/, '');
  var plexToken = String(env.PLEX_TOKEN || file.plexToken || '').trim();
  var port = parseInt(env.PORT || file.port, 10);
  if (!(port > 0 && port < 65536)) port = DEFAULT_PORT;

  if (!plexUrl) {
    throw new Error('plexUrl is missing. Copy config.example.json to config.json and set plexUrl to your Plex address, for example http://192.168.1.10:32400');
  }
  if (!/^https?:\/\//i.test(plexUrl)) {
    throw new Error('plexUrl in config.json must start with http:// or https://');
  }
  if (!plexToken || plexToken === PLACEHOLDER) {
    throw new Error('plexToken is missing. Put your Plex token in config.json. The README shows how to find it.');
  }
  return { plexUrl: plexUrl, plexToken: plexToken, port: port };
}

module.exports = { loadConfig: loadConfig, DEFAULT_PORT: DEFAULT_PORT };

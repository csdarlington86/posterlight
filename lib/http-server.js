'use strict';
// The helper's web server: the page, the status JSON, and resized images.
var http = require('http');
var fs = require('fs');
var path = require('path');
var demo = require('./demo');

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};
var IMAGE_CACHE_MAX = 60;
var SETUP_BODY_MAX = 10000;   // bytes; setup requests are tiny
var DEMO_ID = /^demo-[a-z0-9-]+$/;

function createHttpServer(deps) {
  var publicDir = path.resolve(deps.publicDir);
  var imageCache = new Map();

  function send(res, status, headers, body) {
    headers['X-Content-Type-Options'] = 'nosniff';
    res.writeHead(status, headers);
    res.end(body);
  }

  function sendJson(res, obj) {
    send(res, 200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }, JSON.stringify(obj));
  }

  function notFound(res) {
    send(res, 404, { 'Content-Type': TYPES['.txt'] }, 'Not found');
  }

  function sendFile(res, file, cacheControl) {
    fs.readFile(file, function (err, data) {
      if (err) return notFound(res);
      var type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      send(res, 200, { 'Content-Type': type, 'Cache-Control': cacheControl }, data);
    });
  }

  function serveStatic(res, pathname) {
    var decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch (e) {
      return notFound(res);
    }
    if (decoded.indexOf('\0') !== -1) return notFound(res);
    if (decoded === '/') decoded = '/index.html';
    var file = path.resolve(publicDir, '.' + decoded);
    if (file !== publicDir && file.indexOf(publicDir + path.sep) !== 0) return notFound(res);
    // Fonts and icons never change. The page, CSS, and scripts must refresh after an update.
    var longLived = /^\/(fonts|icons)\//.test(decoded);
    sendFile(res, file, longLived ? 'public, max-age=604800' : 'no-cache');
  }

  function serveImage(res, id, query) {
    if (DEMO_ID.test(id)) {
      return sendFile(res, path.join(publicDir, 'demo', id + '.svg'), 'public, max-age=86400');
    }
    var source = deps.images.sourceFor(id);
    if (!source) return notFound(res);
    var w = deps.images.clampSize(query.get('w'));
    var h = deps.images.clampSize(query.get('h'));
    var key = id + '|' + w + '|' + h;
    var headers = function (type) {
      return { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' };
    };
    var hit = imageCache.get(key);
    if (hit) return send(res, 200, headers(hit.contentType), hit.body);
    deps.getImage(source, w, h).then(function (img) {
      if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value);
      imageCache.set(key, img);
      send(res, 200, headers(img.contentType), img.body);
    }, function () {
      send(res, 502, { 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-store' }, 'Image not available');
    });
  }

  function sendStatusJson(res, status, obj) {
    send(res, status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }, JSON.stringify(obj));
  }

  // POST /api/setup/<step>: the setup page talking to the helper.
  // lib/setup.js decides who is allowed; this function only carries the request to it.
  function serveSetup(req, res, step) {
    if (String(req.headers['content-type'] || '').toLowerCase().indexOf('application/json') !== 0) {
      req.resume();
      return sendStatusJson(res, 415, { error: 'json-only' });
    }
    var allowed = deps.setup.authorize({
      remoteAddress: req.socket.remoteAddress,
      host: req.headers.host,
      header: req.headers['x-posterlight'],
      code: req.headers['x-setup-code']
    });
    if (!allowed.ok) {
      req.resume();
      return sendStatusJson(res, allowed.status, { error: allowed.error });
    }
    var chunks = [];
    var size = 0;
    var tooLarge = false;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > SETUP_BODY_MAX) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on('end', function () {
      if (tooLarge) return sendStatusJson(res, 413, { error: 'too-large' });
      var body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch (e) {
        return sendStatusJson(res, 400, { error: 'bad-json' });
      }
      deps.setup.run(step, body).then(function (out) {
        sendStatusJson(res, out.status, out.json);
      }, function () {
        sendStatusJson(res, 500, { error: 'server-error' });
      });
    });
  }

  return http.createServer(function (req, res) {
    var raw = String(req.url || '/');
    var cut = raw.indexOf('?');
    var pathname = cut === -1 ? raw : raw.slice(0, cut);
    var query = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));

    if (req.method === 'POST' && deps.setup && /^\/api\/setup\/[a-z-]+$/.test(pathname)) {
      return serveSetup(req, res, pathname.slice('/api/setup/'.length));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.resume();
      return send(res, 405, { 'Content-Type': TYPES['.txt'], Allow: 'GET, HEAD' }, 'Method not allowed');
    }

    try {
      if (pathname === '/api/status') {
        var canned = query.has('demo') ? demo.demoStatus(query.get('demo')) : null;
        return sendJson(res, canned || deps.getStatus(query.get('player') || 'any'));
      }
      if (pathname === '/api/players') return sendJson(res, { players: deps.getPlayers() });
      if (pathname === '/healthz') return sendJson(res, { ok: true, plexOk: !!deps.isPlexOk() });
      if (pathname.indexOf('/img/') === 0) {
        var id;
        try { id = decodeURIComponent(pathname.slice(5)); } catch (e) { return notFound(res); }
        return serveImage(res, id, query);
      }
      if (pathname === '/setup') return serveStatic(res, '/setup.html');
      return serveStatic(res, pathname);
    } catch (e) {
      send(res, 500, { 'Content-Type': TYPES['.txt'] }, 'Server error');
    }
  });
}

module.exports = { createHttpServer: createHttpServer };

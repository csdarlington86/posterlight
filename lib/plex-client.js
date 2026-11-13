'use strict';
// The only module that knows the Plex token.
// The token travels in a request header, so it never appears in a URL or a log line.

function createPlexClient(options) {
  var plexUrl = options.plexUrl;
  var plexToken = options.plexToken;
  var fetchImpl = options.fetchImpl || fetch;
  var timeoutMs = options.timeoutMs || 8000;

  function scrub(message) {
    return String(message).split(plexToken).join('[token]');
  }

  // `read` turns the response into the wanted value. The timeout covers the whole exchange,
  // headers and body, so a Plex server that stalls half way can never hang the poll loop.
  function request(path, accept, read) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    function fail(err) {
      clearTimeout(timer);
      if (err && err.fromPlex) throw err;
      var reason = err && err.name === 'AbortError' ? 'no answer in ' + timeoutMs + ' ms' : (err && err.message) || 'request failed';
      throw new Error(scrub('Could not reach Plex: ' + reason));
    }
    return fetchImpl(plexUrl + path, {
      headers: { 'X-Plex-Token': plexToken, Accept: accept },
      // Never follow a redirect: the token header would travel to the new address.
      redirect: 'manual',
      signal: controller.signal
    }).then(function (res) {
      if (!res.ok) {
        if (res.body && res.body.cancel) res.body.cancel().then(null, function () {});
        var refused = new Error('Plex answered ' + res.status + ' for ' + path.split('?')[0]);
        refused.fromPlex = true;
        throw refused;
      }
      return read(res);
    }).then(function (value) {
      clearTimeout(timer);
      return value;
    }, fail);
  }

  function getJson(path) {
    return request(path, 'application/json', function (res) { return res.json(); });
  }

  function getImage(sourcePath, w, h) {
    var path = '/photo/:/transcode?width=' + w + '&height=' + h + '&minSize=1&upscale=0&url=' + encodeURIComponent(sourcePath);
    return request(path, 'image/*', function (res) {
      var contentType = String(res.headers.get('content-type') || '');
      if (contentType.indexOf('image/') !== 0) {
        var notImage = new Error('Plex did not return an image');
        notImage.fromPlex = true;
        throw notImage;
      }
      return res.arrayBuffer().then(function (buf) {
        return { contentType: contentType, body: Buffer.from(buf) };
      });
    });
  }

  return { getJson: getJson, getImage: getImage };
}

module.exports = { createPlexClient: createPlexClient };

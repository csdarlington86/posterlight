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

  function request(path, accept) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetchImpl(plexUrl + path, {
      headers: { 'X-Plex-Token': plexToken, Accept: accept },
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('Plex answered ' + res.status + ' for ' + path.split('?')[0]);
      return res;
    }, function (err) {
      clearTimeout(timer);
      var reason = err && err.name === 'AbortError' ? 'no answer in ' + timeoutMs + ' ms' : (err && err.message) || 'request failed';
      throw new Error(scrub('Could not reach Plex: ' + reason));
    });
  }

  function getJson(path) {
    return request(path, 'application/json').then(function (res) { return res.json(); });
  }

  function getImage(sourcePath, w, h) {
    var path = '/photo/:/transcode?width=' + w + '&height=' + h + '&minSize=1&upscale=0&url=' + encodeURIComponent(sourcePath);
    return request(path, 'image/*').then(function (res) {
      var contentType = String(res.headers.get('content-type') || '');
      if (contentType.indexOf('image/') !== 0) throw new Error('Plex did not return an image');
      return res.arrayBuffer().then(function (buf) {
        return { contentType: contentType, body: Buffer.from(buf) };
      });
    });
  }

  return { getJson: getJson, getImage: getImage };
}

module.exports = { createPlexClient: createPlexClient };

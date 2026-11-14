/* Browser side of the web app: real network requests and real storage for the engine.
   Plain ES5, for iOS 12 Safari. */
(function () {
  'use strict';

  // request(method, url, headers, timeoutMs, done(err, json)); err is { status } on failure.
  function request(method, url, headers, timeoutMs, done) {
    var finished = false;
    function finish(err, json) {
      if (finished) return;
      finished = true;
      done(err, json);
    }
    var xhr = new XMLHttpRequest();
    try {
      xhr.open(method, url, true);
      for (var name in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, name)) xhr.setRequestHeader(name, headers[name]);
      }
    } catch (e) {
      return finish({ status: 0 });
    }
    xhr.timeout = timeoutMs;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) return finish({ status: xhr.status });
      var json;
      try { json = JSON.parse(xhr.responseText); } catch (e) { return finish({ status: 0 }); }
      finish(null, json);
    };
    xhr.onerror = xhr.ontimeout = xhr.onabort = function () { finish({ status: 0 }); };
    try { xhr.send(); } catch (e) { finish({ status: 0 }); }
  }

  // Private browsing can block storage. Then the sign-in lasts until the page closes.
  var memory = {};
  var storage = {
    getItem: function (key) {
      try { var v = window.localStorage.getItem(key); if (v !== null) return v; } catch (e) { /* fall through */ }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem: function (key, value) {
      memory[key] = String(value);
      try { window.localStorage.setItem(key, value); } catch (e) { /* kept in memory only */ }
    },
    removeItem: function (key) {
      delete memory[key];
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  window.PosterLightWeb.request = request;
  window.PosterLightWeb.storage = storage;
})();

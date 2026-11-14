/* Starts the web app's engine and hands it to the poster page. */
(function () {
  'use strict';
  var web = window.PosterLightWeb;
  var engine = web.createWebEngine({ request: web.request, storage: web.storage });
  engine.start();
  window.PosterLightLocal = {
    status: function (player) { return engine.status(player); },
    players: function () { return engine.players(); },
    imageUrl: function (id, w, h) { return engine.imageUrl(id, w, h); },
    setupUrl: 'connect.html',
    setupHint: 'Connect this screen to your Plex account. It takes about a minute.',
    accountUrl: 'connect.html?change=1'
  };
})();

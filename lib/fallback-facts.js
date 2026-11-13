'use strict';
// Builds simple facts from Plex's own data, for titles with no fact file.

var MAX_CAST = 5;

function joinNames(list) {
  if (list.length === 1) return list[0];
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

function buildFallbackFacts(session, index) {
  if (!session || session.type === 'track') return [];
  var facts = [];
  var isEpisode = session.type === 'episode';
  var libraryTitle = isEpisode ? session.showTitle : session.title;
  var directors = session.directors || [];
  var cast = (session.cast || []).slice(0, MAX_CAST);

  if (session.year) {
    facts.push(isEpisode
      ? 'This episode first aired in ' + session.year + '.'
      : session.title + ' was released in ' + session.year + '.');
  }
  if (directors.length) facts.push('Directed by ' + joinNames(directors) + '.');
  if (index) {
    directors.forEach(function (d) {
      var others = index.otherByDirector(d, libraryTitle);
      if (others.length) facts.push(d + ' also directed ' + joinNames(others) + ' in your library.');
    });
  }
  if (session.studio) facts.push('A ' + session.studio + ' production.');
  cast.forEach(function (c) {
    if (c.role) facts.push(c.name + ' plays ' + c.role + '.');
  });
  if (index) {
    cast.forEach(function (c) {
      var others = index.otherByActor(c.name, libraryTitle);
      if (others.length) facts.push('You can also see ' + c.name + ' in ' + joinNames(others) + ' in your library.');
    });
  }
  if (isEpisode && session.showTitle && session.seasonNumber !== null && session.seasonNumber !== undefined &&
      session.episodeNumber !== null && session.episodeNumber !== undefined) {
    facts.push('This is season ' + session.seasonNumber + ', episode ' + session.episodeNumber + ' of ' + session.showTitle + '.');
  }
  return facts;
}

module.exports = { buildFallbackFacts: buildFallbackFacts };

'use strict';
// Turns a title into the file name used for its fact file.

function slugify(title) {
  return String(title === null || title === undefined ? '' : title)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { slugify: slugify };

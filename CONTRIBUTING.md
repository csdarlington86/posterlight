# Contributing to PosterLight

Thank you for helping. Here is how.

## Report a problem

Open an issue and choose a template. Say what device and browser you use.
Remove your Plex token and setup code from anything you paste.

## Change the code

1. Run `npm test` before and after your change. All tests must pass.
2. Write the test first, watch it fail, then write the code.
3. The device page (`public/js/app.js`, `public/js/logic.js`, `public/css/posterlight.css`) must keep working
   on iOS 12 Safari: plain ES5, no build step, no flexbox `gap`, no `aspect-ratio`. The tests in `tests/es5.test.js` check this.
4. Animate only `transform` and `opacity`.
5. Add no npm dependencies.
6. The Plex token must never leave the helper. See [SECURITY.md](SECURITY.md).

## Project layout

See "For developers" in the [README](README.md).

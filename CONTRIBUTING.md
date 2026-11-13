# Contributing to PosterLight

Thank you for helping. There are two easy ways to help, and neither needs deep programming skill.

## Add or fix facts

Facts are the heart of the shared fact pack. Every installation gets them.

1. Read [facts/README.md](facts/README.md) for the file format and the file name rules.
2. Create or edit one file per movie or show.
3. Add an `"ids"` line with the title's IMDb id, for example `"ids": ["imdb://tt0078748"]`.
   The id is in the title's IMDb address. With an id, the file matches in every language.
4. Run the checks:

   ```bash
   npm test
   ```

5. Open a pull request.

### Rules for facts

- **Real and checked.** Check each fact against a reliable source before you add it. If you are not sure, leave it out.
- **Your own words.** Do not copy sentences from a website or a book. State the fact plainly yourself.
- **No spoilers.** Facts show while the title plays. Do not reveal the plot.
- **Short.** 200 characters or fewer. One or two plain sentences.
- **Kind.** No gossip, and nothing unkind about a real person.

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

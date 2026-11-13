# Fact files

PosterLight shows facts from the files in this folder. One file per movie, one file per show.

## File names

- Movies: `facts/movies/<title>-<year>.json`, for example `facts/movies/alien-1979.json`
- Shows: `facts/shows/<title>.json`, for example `facts/shows/severance.json`

Write the title in lower case. Replace spaces and symbols with `-`. Write `and` for `&`.
Remove accents and apostrophes. `WALL·E` (2008) becomes `wall-e-2008.json`.

To get the exact file name for every title in your library, run:

```bash
npm run library
```

## File format

```json
{
  "title": "Alien",
  "year": 1979,
  "facts": [
    "First fact.",
    "Second fact."
  ]
}
```

Shows do not need `year`.

## Rules for facts

1. Write only facts that are real and that you can check.
2. Leave out anything you are not sure of. A short file is fine.
3. Keep each fact to 200 characters or fewer, so it fits on a phone.
4. Do not repeat a fact in the same file.

## How many facts

- A movie shows up to 15 facts in one viewing. Write 15 or more if you can.
- An episode shows 3 facts from its show's file. PosterLight does not reuse a fact
  until it has shown every fact in the file. More facts means fewer repeats.
- A title with no file still shows simple facts from Plex (year, director, cast, studio).

## Check your files

```bash
npm test
```

The test `fact-files` reads every file here and reports any problem with its name or content.

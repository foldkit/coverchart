# Coverchart

A Foldkit app for writing chord charts with lyrics.

## What it does

- Keep a library of songs in this browser (`localStorage`)
- Paste lyrics into named sections (Verse, Chorus, Bridge, …)
- Add chords to a song, then tap a word to place one above it
- Open a play view with large type, transpose, and capo (display only — stored chords stay in the original key)
- Copy a text chart you can paste elsewhere

## Run

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```

## State ownership

The root Model's `songs` collection is the canonical library. Home, Editor, and
Play receive songs through view inputs. Editor and Play also receive the matching
canonical song as update context through their Bindings.

Editor owns its menus, dialogs, drag state, chord input, and editing mode. Lyrics
autosave to the canonical song while typing; cancel restores an intentional
snapshot of that section's original lines. Play owns its clipboard interaction.
Neither Block stores a synchronized copy of the song.

Children report edits directly through OutMessages such as `UpdatedTitle` and
`PlacedChord`. The parent applies each edit to the latest song and returns a `SaveLibrary` Command. The Runtime performs the
write. Save results identify their snapshot so an older save cannot complete a
new song's pending navigation.

Editor and Play instances are keyed by song ID in optional parent-owned wrappers.
The Runtime rejects delayed results from a replaced occurrence, including a
previous visit to the same song. Chord placement also checks its original lyric
before applying generated mark IDs.

## Foldkit preview

This application tracks the Blocks + Effect Layers preview at
[`1f6776fa7ece`](https://github.com/foldkit/foldkit/commit/1f6776fa7ececa766188df5201eefec6ba781b5d).
The exact installed versions are pinned together in `package.json` and `pnpm-lock.yaml`.

- [Verified package manifest](https://foldkit-website-preview-jlwvct0dx-devin-jamesons-projects.vercel.app/preview-release.json)
- [Upgrade guide for this snapshot](https://foldkit-website-preview-jlwvct0dx-devin-jamesons-projects.vercel.app/preview-upgrade)
- [Preview status and migration prompts](https://github.com/foldkit/foldkit/pull/1655)

For subsequent previews, update only the installed Foldkit packages together,
retain their dependency groups, and refresh the managed `FOLDKIT.md` from that
snapshot. Preserve project-specific `AGENTS.md` instructions. Update the exact
`minimumReleaseAgeExclude` entries alongside the package pins.

Verify each upgrade in this repository with typecheck, lint, tests, a production
build, and the song editing, persistence, Menu focus, and play-view flows.
Use the target snapshot's guide; a moving branch is not an installed API version.

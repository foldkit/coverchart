import { Array, Option, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { fromString as urlFromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { ApplyTheme, SavedLibraryJsonString } from './command'
import { Line, Song } from './domain'
import { Flags } from './flags'
import { init } from './init'

const libraryWithSong = (song: Song.Song) => ({ songs: [song] })

describe('library persistence', () => {
  test('saved songs round-trip through localStorage JSON', () => {
    const song = modifyFields(Song.create('song-1', 'section-1'), {
      title: () => 'Blackbird',
      artist: () => 'The Beatles',
      maybeOriginalKey: () => Option.some('G'),
      sections: Array.map(section =>
        modifyFields(section, {
          lines: () => [Line.empty('line-1', 'Blackbird singing')],
        }),
      ),
    })

    const encoded = Schema.encodeSync(SavedLibraryJsonString)(
      libraryWithSong(song),
    )
    const decoded = Schema.decodeSync(SavedLibraryJsonString)(encoded)

    expect(decoded.songs).toHaveLength(1)
    expect(decoded.songs[0]?.title).toBe('Blackbird')
    expect(decoded.songs[0]?.sections[0]?.lines[0]?.lyric).toBe(
      'Blackbird singing',
    )
    expect(decoded.songs[0]?.maybeOriginalKey).toEqual(Option.some('G'))
    expect(decoded.songs[0]?.chords).toEqual([])
    expect(Option.isSome(Song.findById(decoded.songs, 'song-1'))).toBe(true)
  })

  test('still loads libraries written before the JSON codec', () => {
    const encoded = JSON.stringify({
      songs: [
        {
          id: 'song-1',
          title: 'Blackbird',
          artist: 'The Beatles',
          maybeOriginalKey: { _id: 'Option', _tag: 'None' },
          transpose: 0,
          capo: 0,
          sections: [
            {
              id: 'section-1',
              kind: 'Verse',
              lines: [{ id: 'line-1', lyric: 'Blackbird singing', marks: [] }],
            },
          ],
        },
      ],
    })

    const decoded = Schema.decodeSync(SavedLibraryJsonString)(encoded)

    expect(Option.isSome(Song.findById(decoded.songs, 'song-1'))).toBe(true)
    expect(decoded.songs[0]?.chords).toEqual([])
  })

  test('booting on a song URL finds the saved chart', () => {
    const song = Song.create('song-1', 'section-1')
    const encoded = Schema.encodeSync(SavedLibraryJsonString)(
      libraryWithSong(song),
    )
    const decoded = Schema.decodeSync(SavedLibraryJsonString)(encoded)
    const url = Option.getOrThrow(
      urlFromString('http://localhost/songs/song-1'),
    )
    const init_ = init(
      Flags.make({
        maybeSavedLibrary: Option.some(decoded),
        maybeThemePreference: Option.none(),
        systemTheme: 'Light',
      }),
      url,
    )

    expect(init_.model.route._tag).toBe('SongEdit')
    expect(Option.isSome(Song.findById(init_.model.songs, 'song-1'))).toBe(true)
    expect(init_.model.editor.song.id).toBe('song-1')
    expect(init_.model.maybeThemePreference).toEqual(Option.some('System'))
    expect(init_.model.resolvedTheme).toBe('Light')
    expect(init_.commands ?? []).toHaveLength(1)
    expect(init_.commands?.[0]?.name).toBe(ApplyTheme.name)
  })

  test('booting with a saved dark preference resolves dark', () => {
    const url = Option.getOrThrow(urlFromString('http://localhost/'))
    const init_ = init(
      Flags.make({
        maybeSavedLibrary: Option.none(),
        maybeThemePreference: Option.some('Dark'),
        systemTheme: 'Light',
      }),
      url,
    )

    expect(init_.model.maybeThemePreference).toEqual(Option.some('Dark'))
    expect(init_.model.resolvedTheme).toBe('Dark')
    expect(init_.commands ?? []).toHaveLength(1)
    expect(init_.commands?.[0]?.name).toBe(ApplyTheme.name)
  })
})

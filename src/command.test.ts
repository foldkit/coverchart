import { Array, Effect, Layer, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { modifyFields } from 'foldkit/struct'
import { fromString as urlFromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { ApplicationBlock } from './block'
import { SaveLibrary, SavedLibraryJsonString } from './command'
import { EditorBinding } from './composition'
import { STORAGE_KEY } from './constant'
import { Line, Song } from './domain'
import { Flags } from './flags'
import { init } from './init'
import { Message } from './message'
import { EditorBlock } from './page'
import { IdRequest } from './page/editor/message'
import { ApplicationLayer } from './services'
import { applicationModel, urlFor } from './testFixture'
import { update } from './update'

const libraryWithSong = (song: typeof Song.Song.Type) => ({ songs: [song] })

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
    expect(
      Option.map(init_.model.maybeEditorInstance, instance => instance.songId),
    ).toEqual(Option.some('song-1'))
    expect(init_.model.maybeThemePreference).toEqual(Option.some('System'))
    expect(Array.map(init_.commands ?? [], command => command.args)).toEqual([
      { theme: 'Light' },
    ])
    expect(init_.commands ?? []).toHaveLength(1)
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
    expect(Array.map(init_.commands ?? [], command => command.args)).toEqual([
      { theme: 'Dark' },
    ])
    expect(init_.commands ?? []).toHaveLength(1)
  })
})

const emptyEditorView = EditorBlock.makeView((_model, h) => h.empty)
const editorMessage = (
  model: typeof ApplicationBlock.Model.Type,
  message: typeof EditorBlock.Message.Type,
) => {
  const instance = Option.getOrThrow(model.maybeEditorInstance)
  return EditorBinding.embedView({
    key: instance.songId,
    slotId: instance.songId,
    model: instance.model,
    view: emptyEditorView,
  }).toParentMessage(message)
}
const runApplicationCommand = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Layer.Success<typeof ApplicationBlock.EffectsLayer>
  >,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        ApplicationBlock.EffectsLayer.pipe(Layer.provide(ApplicationLayer)),
      ),
    ),
  )

describe('routed editor Commands', () => {
  test.each([{ name: 'different song', paths: ['/songs/song-2'] }])(
    'late IDs cannot change a replacement editor: $name',
    async ({ paths }) => {
      const first = Song.create('song-1', 'section-1')
      const second = Song.create('song-2', 'section-2')
      const initial = applicationModel([first, second], '/songs/song-1')
      const requested = update(
        initial,
        editorMessage(
          initial,
          EditorBlock.Message.ClickedDuplicateSection({
            sectionId: 'section-1',
          }),
        ),
      )
      const pending = Option.getOrThrow(Array.head(requested.commands ?? []))
      expect(pending.args).toEqual({
        count: 1,
        request: IdRequest.DuplicateSection({ sectionId: 'section-1' }),
      })

      const routed = Array.reduce(
        paths,
        requested.model,
        (model, path) =>
          update(model, Message.ChangedUrl({ url: urlFor(path) })).model,
      )
      const resultMessage = await runApplicationCommand(pending.effect)
      const delivered = update(routed, resultMessage)

      expect(delivered.model.songs).toEqual([first, second])
      expect(delivered.commands ?? []).toHaveLength(0)
    },
  )

  test('an in-flight edit applies to the latest canonical song', async () => {
    const song = Song.create('song-1', 'section-1')
    const initial = applicationModel([song], '/songs/song-1')
    const requested = update(
      initial,
      editorMessage(
        initial,
        EditorBlock.Message.ClickedDuplicateSection({ sectionId: 'section-1' }),
      ),
    )
    const pending = Option.getOrThrow(Array.head(requested.commands ?? []))
    const titled = update(
      requested.model,
      editorMessage(
        requested.model,
        EditorBlock.Message.UpdatedTitle({ value: 'New title' }),
      ),
    )

    const resultMessage = await runApplicationCommand(pending.effect)
    const delivered = update(titled.model, resultMessage)
    const canonical = Option.getOrThrow(
      Song.findById(delivered.model.songs, song.id),
    )

    expect(canonical.title).toBe('New title')
    expect(canonical.sections).toHaveLength(2)
    expect(
      Array.dedupe(Array.map(canonical.sections, section => section.id)),
    ).toHaveLength(2)
    expect(
      Array.map(delivered.commands ?? [], command => command.args),
    ).toEqual([{ songs: [canonical] }])
  })

  test('removing the song prevents a delayed result from recreating it', async () => {
    const song = Song.create('song-1', 'section-1')
    const initial = applicationModel([song], '/songs/song-1')
    const requested = update(
      initial,
      editorMessage(
        initial,
        EditorBlock.Message.ClickedDuplicateSection({ sectionId: 'section-1' }),
      ),
    )
    const pending = Option.getOrThrow(Array.head(requested.commands ?? []))
    const removed = modifyFields(requested.model, {
      songs: () => [],
      maybeEditorInstance: () => Option.none(),
      maybePlayInstance: () => Option.none(),
    })

    const resultMessage = await runApplicationCommand(pending.effect)
    const delivered = update(removed, resultMessage)

    expect(delivered.model.songs).toEqual([])
    expect(delivered.model.maybeEditorInstance).toEqual(Option.none())
    expect(delivered.commands ?? []).toHaveLength(0)
  })
})

describe('save handler', () => {
  test('reports the saved snapshot identities and stores its canonical songs', async () => {
    const song = Song.create('song-1', 'section-1')
    const saved = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* KeyValueStore.KeyValueStore
        const message = yield* SaveLibrary({ songs: [song] }).effect.pipe(
          Effect.provide(SaveLibrary.layer),
        )
        const encoded = yield* store.get(STORAGE_KEY)
        return { message, encoded }
      }).pipe(Effect.provide(KeyValueStore.layerMemory)),
    )

    expect(saved.message).toEqual(
      Message.SucceededSaveLibrary({ songIds: [song.id] }),
    )
    const encoded = Option.getOrThrow(Option.fromNullishOr(saved.encoded))
    expect(Schema.decodeSync(SavedLibraryJsonString)(encoded).songs).toEqual([
      song,
    ])
  })

  test('reports which snapshot failed without replacing the real handler', async () => {
    const FailingStoreLayer = Layer.effect(
      KeyValueStore.KeyValueStore,
      Effect.gen(function* () {
        const store = yield* KeyValueStore.KeyValueStore
        return {
          ...store,
          set: () =>
            Effect.fail(
              new KeyValueStore.KeyValueStoreError({
                message: 'Storage is full',
                method: 'set',
              }),
            ),
        }
      }),
    ).pipe(Layer.provide(KeyValueStore.layerMemory))
    const song = Song.create('song-1', 'section-1')
    const message = await Effect.runPromise(
      SaveLibrary({ songs: [song] }).effect.pipe(
        Effect.provide(
          SaveLibrary.layer.pipe(Layer.provide(FailingStoreLayer)),
        ),
      ),
    )

    expect(message).toEqual(
      Message.FailedSaveLibrary({
        error: 'Could not save your songs.',
        songIds: [song.id],
      }),
    )
  })
})

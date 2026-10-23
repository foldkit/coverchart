import { Array, Crypto, Effect, Layer, Match, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { load, pushUrl } from 'foldkit/navigation'

import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './constant'
import { ApplicationDefinition } from './definition'
import { Song } from './domain'
import { Message, ResolvedTheme, ThemePreference } from './message'
import { subscriptions } from './subscription'

export const SavedLibrary = Schema.Struct({
  songs: Schema.Array(Song.Song),
})

export const SavedLibraryJsonString = Schema.fromJsonString(
  Schema.toCodecJson(SavedLibrary),
)

export const GenerateSongIds = ApplicationDefinition.makeCommand(
  'GenerateSongIds',
  {
    messages: [Message.CompletedGenerateSongIds],
    handler: function* () {
      const crypto = yield* Crypto.Crypto

      return () =>
        Effect.gen(function* () {
          const songId = yield* Effect.orDie(crypto.randomUUIDv4)
          const sectionId = yield* Effect.orDie(crypto.randomUUIDv4)
          return Message.CompletedGenerateSongIds({ songId, sectionId })
        })
    },
  },
)

export const SaveLibrary = ApplicationDefinition.makeCommand('SaveLibrary', {
  args: { songs: Schema.Array(Song.Song) },
  messages: [Message.SucceededSaveLibrary, Message.FailedSaveLibrary],
  handler: function* () {
    const store = yield* KeyValueStore.KeyValueStore

    return ({ songs }) =>
      store
        .set(STORAGE_KEY, Schema.encodeSync(SavedLibraryJsonString)({ songs }))
        .pipe(
          Effect.as(
            Message.SucceededSaveLibrary({
              songIds: Array.map(songs, song => song.id),
            }),
          ),
          Effect.catch(() =>
            Effect.succeed(
              Message.FailedSaveLibrary({
                error: 'Could not save your songs.',
                songIds: Array.map(songs, song => song.id),
              }),
            ),
          ),
        )
  },
})

export const NavigateInternal = ApplicationDefinition.makeCommand(
  'NavigateInternal',
  {
    args: { url: Schema.String },
    messages: [Message.CompletedNavigateInternal],
    handler: function* () {
      return ({ url }) =>
        pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal()))
    },
  },
)

export const LoadExternal = ApplicationDefinition.makeCommand('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  handler: function* () {
    return ({ href }) =>
      load(href).pipe(Effect.as(Message.CompletedLoadExternal()))
  },
})

const setThemeColorMeta = (color: string): void => {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta !== null) {
    themeColorMeta.setAttribute('content', color)
  }
}

export const ApplyTheme = ApplicationDefinition.makeCommand('ApplyTheme', {
  args: { theme: ResolvedTheme },
  messages: [Message.CompletedApplyTheme],
  handler: function* () {
    return ({ theme }) =>
      Effect.sync(() => {
        Match.value(theme).pipe(
          Match.when('Dark', () => {
            document.documentElement.classList.add('dark')
            setThemeColorMeta(DARK_THEME_COLOR)
          }),
          Match.when('Light', () => {
            document.documentElement.classList.remove('dark')
            setThemeColorMeta(LIGHT_THEME_COLOR)
          }),
          Match.exhaustive,
        )
        return Message.CompletedApplyTheme()
      })
  },
})

export const SaveThemePreference = ApplicationDefinition.makeCommand(
  'SaveThemePreference',
  {
    args: { preference: ThemePreference },
    messages: [Message.CompletedSaveThemePreference],
    handler: function* () {
      const store = yield* KeyValueStore.KeyValueStore

      return ({ preference }) =>
        store.set(THEME_STORAGE_KEY, JSON.stringify(preference)).pipe(
          Effect.as(Message.CompletedSaveThemePreference()),
          Effect.catch(() =>
            Effect.succeed(Message.CompletedSaveThemePreference()),
          ),
        )
    },
  },
)

export const EffectsLayer = Layer.mergeAll(
  GenerateSongIds.layer,
  SaveLibrary.layer,
  NavigateInternal.layer,
  LoadExternal.layer,
  ApplyTheme.layer,
  SaveThemePreference.layer,
  subscriptions.layer,
)

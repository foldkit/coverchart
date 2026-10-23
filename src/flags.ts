import { Effect, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'

import { SavedLibrary, SavedLibraryJsonString } from './command'
import { STORAGE_KEY, THEME_STORAGE_KEY } from './constant'
import { ResolvedTheme, ThemePreference } from './message'

export const Flags = Schema.Struct({
  maybeSavedLibrary: Schema.Option(SavedLibrary),
  maybeThemePreference: Schema.Option(ThemePreference),
  systemTheme: ResolvedTheme,
})

export type Flags = typeof Flags.Type

const loadSavedLibrary = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore
  const json = yield* Effect.fromOption(
    Option.fromNullishOr(yield* store.get(STORAGE_KEY)),
  )
  const decoded = yield* Schema.decodeEffect(SavedLibraryJsonString)(json)
  return Option.some(decoded)
}).pipe(Effect.catch(() => Effect.succeed(Option.none<SavedLibrary>())))

const loadThemePreference = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore
  const json = yield* Effect.fromOption(
    Option.fromNullishOr(yield* store.get(THEME_STORAGE_KEY)),
  )
  const theme = yield* Schema.decodeEffect(
    Schema.fromJsonString(ThemePreference),
  )(json)
  return Option.some(theme)
}).pipe(Effect.catch(() => Effect.succeed(Option.none<ThemePreference>())))

export const flags: Effect.Effect<Flags, never, KeyValueStore.KeyValueStore> =
  Effect.gen(function* () {
    const maybeSavedLibrary = yield* loadSavedLibrary
    const maybeThemePreference = yield* loadThemePreference
    const systemTheme: ResolvedTheme = yield* Effect.sync(() =>
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'Dark'
        : 'Light',
    )
    return Flags.make({
      maybeSavedLibrary,
      maybeThemePreference,
      systemTheme,
    })
  })

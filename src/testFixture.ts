import { Option } from 'effect'
import { fromString } from 'foldkit/url'

import { Song } from './domain'
import { Flags } from './flags'
import { init } from './init'

export const urlFor = (path: string) =>
  Option.getOrThrow(fromString(`http://localhost${path}`))

export const applicationModel = (
  songs: ReadonlyArray<typeof Song.Song.Type> = [],
  path = '/',
) =>
  init(
    Flags.make({
      maybeSavedLibrary: Option.some({ songs }),
      maybeThemePreference: Option.none(),
      systemTheme: 'Light',
    }),
    urlFor(path),
  ).model

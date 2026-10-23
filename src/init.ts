import { Match, Option } from 'effect'
import { Url } from 'foldkit/url'

import { ApplyTheme } from './command'
import { ApplicationComposition } from './composition'
import { PLACEHOLDER_SECTION_ID, PLACEHOLDER_SONG_ID } from './constant'
import { Song } from './domain'
import type { Flags } from './flags'
import { ThemePreference } from './message'
import { urlToApplicationRoute } from './route'
import { resolveTheme } from './theme'

export const init = ApplicationComposition.makeInit(
  (flags: Flags, url: Url) => {
    const route = urlToApplicationRoute(url)
    const songs = Option.match(flags.maybeSavedLibrary, {
      onNone: () => [],
      onSome: ({ songs }) => songs,
    })
    const maybeCurrentSong = Match.value(route).pipe(
      Match.tag('SongEdit', ({ songId }) => Song.findById(songs, songId)),
      Match.tag('SongPlay', ({ songId }) => Song.findById(songs, songId)),
      Match.orElse(() => Option.none()),
    )
    const currentSong = Option.getOrElse(maybeCurrentSong, () =>
      Song.create(PLACEHOLDER_SONG_ID, PLACEHOLDER_SECTION_ID),
    )
    const themePreference: ThemePreference = Option.getOrElse(
      flags.maybeThemePreference,
      () => 'System',
    )
    const resolvedTheme = resolveTheme(themePreference, flags.systemTheme)

    return {
      model: {
        route,
        songs,
        maybePendingEditSongId: Option.none(),
        maybeThemePreference: Option.some(themePreference),
        systemTheme: flags.systemTheme,
        resolvedTheme,
      },
      childInitContext: currentSong,
      commands: [ApplyTheme({ theme: resolvedTheme })],
    }
  },
)

import { Match, Option } from 'effect'
import { Url } from 'foldkit/url'

import { ApplyTheme } from './command'
import { ApplicationComposition, initSongPages } from './composition'
import { Song } from './domain'
import type { Flags } from './flags'
import { ThemePreference } from './message'
import { urlToApplicationRoute } from './route'
import { resolveTheme } from './theme'

export const init = ApplicationComposition.makeInit(
  (flags: typeof Flags.Type, url: typeof Url.Type) => {
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
    const themePreference: typeof ThemePreference.Type = Option.getOrElse(
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
        maybeEditorInstance: Option.none(),
        maybePlayInstance: Option.none(),
      },
      steps: Option.toArray(
        Option.map(maybeCurrentSong, song => initSongPages(song.id)),
      ),
      commands: [ApplyTheme({ theme: resolvedTheme })],
    }
  },
)

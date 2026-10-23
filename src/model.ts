import { Schema } from 'effect'

import { Song } from './domain'
import { ResolvedTheme, ThemePreference } from './message'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ApplicationRoute } from './route'
import { ToastBlock } from './toast'

export const Model = Schema.Struct({
  route: ApplicationRoute,
  songs: Schema.Array(Song.Song),
  home: HomeBlock.Model,
  editor: EditorBlock.Model,
  play: PlayBlock.Model,
  toast: ToastBlock.Model,
  maybePendingEditSongId: Schema.Option(Schema.String),
  maybeThemePreference: Schema.Option(ThemePreference),
  systemTheme: ResolvedTheme,
  resolvedTheme: ResolvedTheme,
})

export type Model = typeof Model.Type

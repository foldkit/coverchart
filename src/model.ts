import { Schema } from 'effect'

import { Song } from './domain'
import { ResolvedTheme, ThemePreference } from './message'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ApplicationRoute } from './route'
import { ToastBlock } from './toast'

export const EditorInstance = Schema.Struct({
  songId: Schema.String,
  model: EditorBlock.Model,
})
export const PlayInstance = Schema.Struct({
  songId: Schema.String,
  model: PlayBlock.Model,
})

export const Model = Schema.Struct({
  route: ApplicationRoute,
  songs: Schema.Array(Song.Song),
  home: HomeBlock.Model,
  maybeEditorInstance: Schema.Option(EditorInstance),
  maybePlayInstance: Schema.Option(PlayInstance),
  toast: ToastBlock.Model,
  maybePendingEditSongId: Schema.Option(Schema.String),
  maybeThemePreference: Schema.Option(ThemePreference),
  systemTheme: ResolvedTheme,
})

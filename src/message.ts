import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

export const ThemePreference = Schema.Literals(['Dark', 'Light', 'System'])

export const ResolvedTheme = Schema.Literals(['Dark', 'Light'])

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedGenerateSongIds: { songId: Schema.String, sectionId: Schema.String },
  SucceededSaveLibrary: { songIds: Schema.Array(Schema.String) },
  FailedSaveLibrary: {
    error: Schema.String,
    songIds: Schema.Array(Schema.String),
  },
  CompletedApplyTheme: {},
  CompletedSaveThemePreference: {},
  SelectedThemePreference: { preference: ThemePreference },
  ChangedSystemTheme: { theme: ResolvedTheme },
})

import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

export const ThemePreference = Schema.Literals(['Dark', 'Light', 'System'])
export type ThemePreference = typeof ThemePreference.Type

export const ResolvedTheme = Schema.Literals(['Dark', 'Light'])
export type ResolvedTheme = typeof ResolvedTheme.Type

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedGenerateSongIds: { songId: Schema.String, sectionId: Schema.String },
  SucceededSaveLibrary: {},
  FailedSaveLibrary: { error: Schema.String },
  CompletedApplyTheme: {},
  CompletedSaveThemePreference: {},
  SelectedThemePreference: { preference: ThemePreference },
  ChangedSystemTheme: { theme: ResolvedTheme },
})
export type Message = typeof Message.Type

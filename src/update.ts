import { Array, Match, Option } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { toString as urlToString } from 'foldkit/url'

import {
  ApplyTheme,
  LoadExternal,
  NavigateInternal,
  SaveLibrary,
  SaveThemePreference,
} from './command'
import {
  ApplicationComposition,
  ToastBinding,
  initSongPages,
} from './composition'
import { ApplicationDefinition } from './definition'
import { Song } from './domain'
import { songEditRouter, urlToApplicationRoute } from './route'
import { resolveTheme } from './theme'

export const update = ApplicationComposition.makeUpdate({
  ClickedLink: (model, { request }) =>
    Match.value(request).pipe(
      Match.tagsExhaustive({
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),
    ),

  ChangedUrl: (model, { url }) => {
    const nextRoute = urlToApplicationRoute(url)
    const nextModel = modifyFields(model, { route: () => nextRoute })

    return Match.value(nextRoute).pipe(
      Match.tag('SongEdit', 'SongPlay', ({ songId }) =>
        Option.match(Song.findById(model.songs, songId), {
          onNone: () => ApplicationDefinition.makeNoopStep()(nextModel),
          onSome: () => initSongPages(songId)(nextModel),
        }),
      ),
      Match.orElse(() => ApplicationDefinition.makeNoopStep()(nextModel)),
    )
  },

  CompletedNavigateInternal: ApplicationDefinition.makeNoopStep(),
  CompletedLoadExternal: ApplicationDefinition.makeNoopStep(),

  CompletedGenerateSongIds: (model, { songId, sectionId }) => {
    const song = Song.create(songId, sectionId)

    const songs = Song.upsert(model.songs, song)
    return {
      model: modifyFields(model, {
        songs: () => songs,
        maybePendingEditSongId: () => Option.some(songId),
      }),
      commands: [SaveLibrary({ songs })],
    }
  },

  SucceededSaveLibrary: (model, { songIds }) =>
    Option.match(model.maybePendingEditSongId, {
      onNone: () => ({ model }),
      onSome: songId =>
        Array.contains(songIds, songId)
          ? {
              model: modifyFields(model, {
                maybePendingEditSongId: () => Option.none(),
              }),
              commands: [NavigateInternal({ url: songEditRouter({ songId }) })],
            }
          : { model },
    }),

  FailedSaveLibrary: (model, { error, songIds }) =>
    ToastBinding.requestShow({
      variant: 'Error',
      payload: { title: error, maybeDescription: Option.none() },
    })(
      modifyFields(model, {
        maybePendingEditSongId: Option.filter(
          songId => !Array.contains(songIds, songId),
        ),
      }),
    ),

  CompletedApplyTheme: ApplicationDefinition.makeNoopStep(),
  CompletedSaveThemePreference: ApplicationDefinition.makeNoopStep(),

  SelectedThemePreference: (model, { preference }) => {
    const resolvedTheme = resolveTheme(preference, model.systemTheme)

    return {
      model: modifyFields(model, {
        maybeThemePreference: () => Option.some(preference),
      }),
      commands: [
        ApplyTheme({ theme: resolvedTheme }),
        SaveThemePreference({ preference }),
      ],
    }
  },

  ChangedSystemTheme: (model, { theme }) => {
    const resolvedTheme = resolveTheme(
      Option.getOrElse(model.maybeThemePreference, () => 'System'),
      theme,
    )

    return {
      model: modifyFields(model, {
        systemTheme: () => theme,
      }),
      commands: [ApplyTheme({ theme: resolvedTheme })],
    }
  },
})

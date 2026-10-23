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
import { Song } from './domain'
import { Message } from './message'
import { songEditRouter, urlToApplicationRoute } from './route'
import { resolveTheme } from './theme'

export const update = ApplicationComposition.makeUpdate((model, message) =>
  Message.match(message, {
    ClickedLink: ({ request }) =>
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

    ChangedUrl: ({ url }) => {
      const nextRoute = urlToApplicationRoute(url)
      const nextModel = modifyFields(model, { route: () => nextRoute })

      return Match.value(nextRoute).pipe(
        Match.tag('SongEdit', 'SongPlay', ({ songId }) =>
          Option.match(Song.findById(model.songs, songId), {
            onNone: () => ({ model: nextModel }),
            onSome: () => initSongPages(songId)(nextModel),
          }),
        ),
        Match.orElse(() => ({ model: nextModel })),
      )
    },

    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),

    CompletedGenerateSongIds: ({ songId, sectionId }) => {
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

    SucceededSaveLibrary: ({ songIds }) =>
      Option.match(model.maybePendingEditSongId, {
        onNone: () => ({ model }),
        onSome: songId =>
          Array.contains(songIds, songId)
            ? {
                model: modifyFields(model, {
                  maybePendingEditSongId: () => Option.none(),
                }),
                commands: [
                  NavigateInternal({ url: songEditRouter({ songId }) }),
                ],
              }
            : { model },
      }),

    FailedSaveLibrary: ({ error, songIds }) =>
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

    CompletedApplyTheme: () => ({ model }),
    CompletedSaveThemePreference: () => ({ model }),

    SelectedThemePreference: ({ preference }) => {
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

    ChangedSystemTheme: ({ theme }) => {
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
  }),
)

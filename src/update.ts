import { Match, Option } from 'effect'
import { Update } from 'foldkit'
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
  EditorBinding,
  PlayBinding,
  ToastBinding,
} from './composition'
import { ApplicationDefinition } from './definition'
import { Song } from './domain'
import { Message } from './message'
import { songEditRouter, urlToApplicationRoute } from './route'
import { resolveTheme } from './theme'

const initEditor = (song: Song.Song) =>
  ApplicationDefinition.makeStep(model =>
    EditorBinding.init({
      args: [song],
      toParentModel: editor => modifyFields(model, { editor: () => editor }),
    }),
  )

const initPlay = (song: Song.Song) =>
  ApplicationDefinition.makeStep(model =>
    PlayBinding.init({
      args: [song],
      toParentModel: play => modifyFields(model, { play: () => play }),
    }),
  )

const initEditorBySongId = (songId: string) =>
  ApplicationDefinition.makeStep(model =>
    Option.match(Song.findById(model.songs, songId), {
      onNone: () => ({ model }),
      onSome: song =>
        model.editor.song.id === song.id
          ? { model }
          : EditorBinding.init({
              args: [song],
              toParentModel: editor =>
                modifyFields(model, { editor: () => editor }),
            }),
    }),
  )

const initPlayBySongId = (songId: string) =>
  ApplicationDefinition.makeStep(model =>
    Option.match(Song.findById(model.songs, songId), {
      onNone: () => ({ model }),
      onSome: song =>
        model.play.song.id === song.id
          ? { model }
          : PlayBinding.init({
              args: [song],
              toParentModel: play => modifyFields(model, { play: () => play }),
            }),
    }),
  )

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
          Update.combineSteps(nextModel, [
            initEditorBySongId(songId),
            initPlayBySongId(songId),
          ]),
        ),
        Match.orElse(() => ({ model: nextModel })),
      )
    },

    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),

    CompletedGenerateSongIds: ({ songId, sectionId }) => {
      const song = Song.create(songId, sectionId)

      return Update.combineSteps(model, [
        initEditor(song),
        initPlay(song),
        ApplicationDefinition.makeStep(currentModel => ({
          model: modifyFields(currentModel, {
            songs: songs => Song.upsert(songs, song),
            maybePendingEditSongId: () => Option.some(songId),
          }),
          commands: [
            SaveLibrary({ songs: Song.upsert(currentModel.songs, song) }),
          ],
        })),
      ])
    },

    SucceededSaveLibrary: () =>
      Option.match(model.maybePendingEditSongId, {
        onNone: () => ({ model }),
        onSome: songId => ({
          model: modifyFields(model, {
            maybePendingEditSongId: () => Option.none(),
          }),
          commands: [NavigateInternal({ url: songEditRouter({ songId }) })],
        }),
      }),

    FailedSaveLibrary: ({ error }) =>
      ToastBinding.requestShow({
        variant: 'Error',
        payload: { title: error, maybeDescription: Option.none() },
      })(
        modifyFields(model, {
          maybePendingEditSongId: () => Option.none(),
        }),
      ),

    CompletedApplyTheme: () => ({ model }),
    CompletedSaveThemePreference: () => ({ model }),

    SelectedThemePreference: ({ preference }) => {
      const resolvedTheme = resolveTheme(preference, model.systemTheme)

      return {
        model: modifyFields(model, {
          maybeThemePreference: () => Option.some(preference),
          resolvedTheme: () => resolvedTheme,
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
          resolvedTheme: () => resolvedTheme,
        }),
        commands: [ApplyTheme({ theme: resolvedTheme })],
      }
    },
  }),
)

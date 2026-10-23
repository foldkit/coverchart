import { Number, Option, String } from 'effect'
import { Update } from 'foldkit'
import type { Block } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { GenerateSongIds, SaveLibrary } from './command'
import { MAX_CAPO, MAX_TRANSPOSE } from './constant'
import { ApplicationDefinition } from './definition'
import { Line, Section, Song } from './domain'
import { EditorInstance, PlayInstance } from './model'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ToastBlock } from './toast'

export const HomeBinding = ApplicationDefinition.makeBinding(HomeBlock, {
  field: 'home',
})

export const EditorBinding = ApplicationDefinition.makeBinding(EditorBlock, {
  field: 'maybeEditorInstance',
  key: 'songId',
  childField: 'model',
  delivery: {
    when: (model, songId) => Option.isSome(Song.findById(model.songs, songId)),
    toUpdateContext: (model, songId) => [Song.findById(model.songs, songId)],
  },
  subscriptions: {
    when: (model, songId) =>
      model.route._tag === 'SongEdit' && model.route.songId === songId,
  },
})

export const PlayBinding = ApplicationDefinition.makeBinding(PlayBlock, {
  field: 'maybePlayInstance',
  key: 'songId',
  childField: 'model',
  delivery: {
    when: (model, songId) => Option.isSome(Song.findById(model.songs, songId)),
    toUpdateContext: (model, songId) => [Song.findById(model.songs, songId)],
  },
})

export const ToastBinding = ApplicationDefinition.makeBinding(ToastBlock, {
  field: 'toast',
  init: { contextToArgs: () => [{ id: 'app-toast' }] },
})

const initEditor = (songId: string) =>
  ApplicationDefinition.makeStep(model => {
    if (
      Option.exists(
        model.maybeEditorInstance,
        instance => instance.songId === songId,
      )
    ) {
      return { model }
    }
    return EditorBinding.init({
      key: songId,
      args: [],
      toParentModel: editor =>
        modifyFields(model, {
          maybeEditorInstance: () =>
            Option.some(EditorInstance.make({ songId, model: editor })),
        }),
    })
  })

const initPlay = (songId: string) =>
  ApplicationDefinition.makeStep(model => {
    if (
      Option.exists(
        model.maybePlayInstance,
        instance => instance.songId === songId,
      )
    ) {
      return { model }
    }
    return PlayBinding.init({
      key: songId,
      args: [],
      toParentModel: play =>
        modifyFields(model, {
          maybePlayInstance: () =>
            Option.some(PlayInstance.make({ songId, model: play })),
        }),
    })
  })

export const initSongPages = (songId: string) =>
  Update.combineSteps([initEditor(songId), initPlay(songId)])

const editSong = (
  songId: string,
  edit: (song: typeof Song.Song.Type) => typeof Song.Song.Type,
) =>
  ApplicationDefinition.makeStep(model =>
    Option.match(Song.findById(model.songs, songId), {
      onNone: () => ({ model }),
      onSome: currentSong => {
        const songs = Song.upsert(model.songs, edit(currentSong))
        return {
          model: modifyFields(model, { songs: () => songs }),
          commands: [SaveLibrary({ songs })],
        }
      },
    }),
  )

const foldHomeOutMessage = ApplicationDefinition.makeOutMessageFold(HomeBlock, {
  RequestedNewSong: () =>
    ApplicationDefinition.makeStep(model => ({
      model,
      commands: [GenerateSongIds()],
    })),
  ConfirmedDeleteSong: ({ songId }) =>
    ApplicationDefinition.makeStep(model => {
      const songs = Song.remove(model.songs, songId)
      return {
        model: modifyFields(model, {
          songs: () => songs,
          maybeEditorInstance: Option.filter(
            instance => instance.songId !== songId,
          ),
          maybePlayInstance: Option.filter(
            instance => instance.songId !== songId,
          ),
        }),
        commands: [SaveLibrary({ songs })],
      }
    }),
})

const foldEditorOutMessage = (songId: string) =>
  ApplicationDefinition.makeOutMessageFold(EditorBlock, {
    UpdatedTitle: ({ value }) =>
      editSong(songId, song => modifyFields(song, { title: () => value })),
    UpdatedArtist: ({ value }) =>
      editSong(songId, song => modifyFields(song, { artist: () => value })),
    UpdatedOriginalKey: ({ value }) =>
      editSong(songId, song =>
        modifyFields(song, {
          maybeOriginalKey: () =>
            Option.liftPredicate(value.trim(), String.isNonEmpty),
        }),
      ),
    UpdatedLyrics: ({ sectionId, draft }) =>
      editSong(songId, song =>
        Song.updateSection(song, sectionId, section =>
          Section.replaceLyrics(section, draft),
        ),
      ),
    RestoredLyrics: ({ sectionId, lines }) =>
      editSong(songId, song =>
        Song.updateSection(song, sectionId, section =>
          modifyFields(section, { lines: () => lines }),
        ),
      ),
    AddedChord: ({ name }) =>
      editSong(songId, song => Song.addChord(song, name)),
    RemovedChord: ({ name }) =>
      editSong(songId, song => Song.removeChord(song, name)),
    PlacedChord: ({ lineId, mark }) =>
      editSong(songId, song =>
        Song.addChord(
          Song.updateLine(song, lineId, line => Line.upsertMark(line, mark)),
          mark.name,
        ),
      ),
    RenamedChord: ({ lineId, markId, name }) =>
      editSong(songId, song =>
        Song.addChord(
          Song.updateLine(song, lineId, line =>
            Line.updateMarkName(line, markId, name),
          ),
          name,
        ),
      ),
    ClearedChord: ({ lineId, markId }) =>
      editSong(songId, song =>
        Song.updateLine(song, lineId, line => Line.removeMark(line, markId)),
      ),
    AddedSection: ({ section }) =>
      editSong(songId, song => Song.addSection(song, section)),
    DuplicatedSection: ({ afterSectionId, section }) =>
      editSong(songId, song =>
        Song.insertSectionAfter(song, afterSectionId, section),
      ),
    RemovedSection: ({ sectionId }) =>
      editSong(songId, song => Song.removeSection(song, sectionId)),
    ReorderedSection: ({ sectionId, toIndex }) =>
      editSong(songId, song => Song.reorderSections(song, sectionId, toIndex)),
  })

const showToast = (variant: 'Success' | 'Error', title: string) =>
  ToastBinding.requestShow({
    variant,
    payload: { title, maybeDescription: Option.none() },
  })

const foldPlayOutMessage = (songId: string) =>
  ApplicationDefinition.makeOutMessageFold(PlayBlock, {
    AdjustedTranspose: ({ by }) =>
      editSong(songId, song =>
        modifyFields(song, {
          transpose: current =>
            Number.clamp(current + by, {
              minimum: -MAX_TRANSPOSE,
              maximum: MAX_TRANSPOSE,
            }),
        }),
      ),
    AdjustedCapo: ({ by }) =>
      editSong(songId, song =>
        modifyFields(song, {
          capo: current =>
            Number.clamp(current + by, { minimum: 0, maximum: MAX_CAPO }),
        }),
      ),
    CopiedChart: () => showToast('Success', 'Chart copied'),
    FailedCopy: ({ error }) => showToast('Error', error),
  })

export const ApplicationComposition = ApplicationDefinition.makeComposition({
  bindings: [
    HomeBinding.withOutMessagePolicy({ fold: foldHomeOutMessage }),
    EditorBinding.withOutMessagePolicy({
      fold: (songId, outMessage) => foldEditorOutMessage(songId)(outMessage),
    }),
    PlayBinding.withOutMessagePolicy({
      fold: (songId, outMessage) => foldPlayOutMessage(songId)(outMessage),
    }),
    ToastBinding.withOutMessagePolicy({
      fold: ApplicationDefinition.makeOutMessageFold(ToastBlock, {
        DismissedToast: ApplicationDefinition.makeNoopStep,
      }),
    }),
  ],
})
export type ApplicationViewBuilder = Block.ViewBuilderFor<
  typeof ApplicationComposition
>

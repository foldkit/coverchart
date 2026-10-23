import { Array, Match, Option, String, pipe } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Line, Section, Song } from '../../domain'
import { GenerateEditorIds } from './command'
import {
  ChordMenuBinding,
  DeleteSectionDialogBinding,
  EditorComposition,
} from './composition'
import { IdRequest, Message, OutMessage } from './message'
import { EditorMode, type Model, type PlacingChord } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>
const withUpdateReturn = Match.withReturnType<UpdateReturn>()

const emitSong = (model: Model, song: Song.Song): UpdateReturn => ({
  model: modifyFields(model, {
    song: () => song,
    mode: () => EditorMode.Viewing(),
  }),
  outMessage: OutMessage.UpdatedSong({ song }),
})

const emitSongKeepMode = (model: Model, song: Song.Song): UpdateReturn => ({
  model: modifyFields(model, { song: () => song }),
  outMessage: OutMessage.UpdatedSong({ song }),
})

const commitChord = (model: Model, placing: PlacingChord, name: string) => {
  if (pipe(name, String.isEmpty)) {
    return Option.match(placing.maybeMarkId, {
      onNone: () => ({
        model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
      }),
      onSome: markId => {
        const song = Song.updateLine(model.song, placing.lineId, line =>
          Line.removeMark(line, markId),
        )
        return emitSong(model, song)
      },
    })
  }

  return Option.match(placing.maybeMarkId, {
    onSome: markId => {
      const song = Song.addChord(
        Song.updateLine(model.song, placing.lineId, line =>
          Line.updateMarkName(line, markId, name),
        ),
        name,
      )
      return emitSong(model, song)
    },
    onNone: () => ({
      model: modifyFields(model, {
        song: () => Song.addChord(model.song, name),
      }),
      commands: [
        GenerateEditorIds({
          count: 1,
          request: IdRequest.NewMark({
            lineId: placing.lineId,
            at: placing.at,
            name,
          }),
        }),
      ],
    }),
  })
}

const applyLyricsDraft = (
  model: Model,
  sectionId: string,
  draft: string,
): Song.Song =>
  Song.updateSection(model.song, sectionId, section =>
    Section.replaceLyrics(section, draft),
  )

const handleCompletedGenerateEditorIds =
  (model: Model) =>
  ({
    ids,
    request,
  }: {
    ids: ReadonlyArray<string>
    request: IdRequest
  }): UpdateReturn =>
    Match.value(request).pipe(
      withUpdateReturn,
      Match.tagsExhaustive({
        NewSection: ({ kind }) =>
          Option.match(Array.head(ids), {
            onNone: () => ({ model }),
            onSome: id =>
              emitSongKeepMode(
                model,
                Song.addSection(model.song, Section.empty(id, kind)),
              ),
          }),
        DuplicateSection: ({ sectionId }) =>
          Option.match(Song.findSection(model.song, sectionId), {
            onNone: () => ({ model }),
            onSome: section =>
              Option.match(Section.duplicate(section, ids), {
                onNone: () => ({ model }),
                onSome: duplicated =>
                  emitSongKeepMode(
                    model,
                    Song.insertSectionAfter(model.song, sectionId, duplicated),
                  ),
              }),
          }),
        NewMark: ({ lineId, at, name }) =>
          Option.match(Array.head(ids), {
            onNone: () => ({ model }),
            onSome: id => {
              const song = Song.updateLine(model.song, lineId, line =>
                Line.upsertMark(line, { id, at, name }),
              )
              return emitSong(model, song)
            },
          }),
      }),
    )

export const update = EditorComposition.makeUpdate((model, message) =>
  Message.match(message, {
    InformedOfSongChange: ({ song }) => ({
      model:
        model.song.id === song.id
          ? modifyFields(model, { song: () => song })
          : model,
    }),

    UpdatedTitle: ({ value }) =>
      emitSongKeepMode(model, modifyFields(model.song, { title: () => value })),

    UpdatedArtist: ({ value }) =>
      emitSongKeepMode(
        model,
        modifyFields(model.song, { artist: () => value }),
      ),

    UpdatedOriginalKey: ({ value }) =>
      emitSongKeepMode(
        model,
        modifyFields(model.song, {
          maybeOriginalKey: () =>
            Option.liftPredicate(pipe(value, String.trim), String.isNonEmpty),
        }),
      ),

    ClickedEditLyrics: ({ sectionId }) =>
      Option.match(Song.findSection(model.song, sectionId), {
        onNone: () => ({ model }),
        onSome: section =>
          ChordMenuBinding.requestClose()(
            modifyFields(model, {
              mode: () =>
                EditorMode.EditingLyrics({
                  sectionId,
                  draft: Section.lyricsText(section),
                  backupLines: section.lines,
                }),
            }),
          ),
      }),

    UpdatedLyricsDraft: ({ value }) =>
      Match.value(model.mode).pipe(
        withUpdateReturn,
        Match.tag('EditingLyrics', editing => {
          const song = applyLyricsDraft(model, editing.sectionId, value)
          return {
            model: modifyFields(model, {
              mode: () => modifyFields(editing, { draft: () => value }),
              song: () => song,
            }),
            outMessage: OutMessage.UpdatedSong({ song }),
          }
        }),
        Match.orElse(() => ({ model })),
      ),

    ClickedSaveLyrics: () => ({
      model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
    }),

    ClickedCancelLyrics: () =>
      Match.value(model.mode).pipe(
        withUpdateReturn,
        Match.tag('EditingLyrics', ({ sectionId, backupLines }) => {
          const song = Song.updateSection(model.song, sectionId, section =>
            modifyFields(section, { lines: () => backupLines }),
          )
          return {
            model: modifyFields(model, {
              song: () => song,
              mode: () => EditorMode.Viewing(),
            }),
            outMessage: OutMessage.UpdatedSong({ song }),
          }
        }),
        Match.orElse(() => ({
          model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
        })),
      ),

    ClickedWord: ({ lineId, at }) => {
      const maybeMark = pipe(
        Song.findLine(model.song, lineId),
        Option.flatMap(line => Line.markAt(line, at)),
      )
      return ChordMenuBinding.requestOpen()(
        modifyFields(model, {
          mode: () =>
            EditorMode.PlacingChord({
              lineId,
              at,
              maybeMarkId: Option.map(maybeMark, ({ id }) => id),
            }),
        }),
      )
    },

    UpdatedPaletteDraft: ({ value }) => ({
      model: modifyFields(model, { paletteDraft: () => value }),
    }),

    SubmittedPaletteChord: () => {
      const name = pipe(model.paletteDraft, String.trim)
      if (pipe(name, String.isEmpty)) {
        return { model: modifyFields(model, { paletteDraft: () => '' }) }
      }

      const nextModel = modifyFields(model, {
        song: () => Song.addChord(model.song, name),
        paletteDraft: () => '',
      })

      return Match.value(model.mode).pipe(
        Match.tag('PlacingChord', placing =>
          commitChord(nextModel, placing, name),
        ),
        Match.orElse(() => ({
          model: nextModel,
          outMessage: OutMessage.UpdatedSong({ song: nextModel.song }),
        })),
      )
    },

    ClickedRemovePaletteChord: ({ name }) =>
      emitSongKeepMode(model, Song.removeChord(model.song, name)),

    ClickedRemoveSection: ({ sectionId }) =>
      Array.match(model.song.sections, {
        onEmpty: () => ({ model }),
        onNonEmpty: sections =>
          Array.match(Array.drop(sections, 1), {
            onEmpty: () => ({ model }),
            onNonEmpty: () =>
              DeleteSectionDialogBinding.requestOpen()(
                modifyFields(model, {
                  maybePendingDeleteSectionId: () => Option.some(sectionId),
                }),
              ),
          }),
      }),

    ClickedConfirmRemoveSection: () =>
      Option.match(model.maybePendingDeleteSectionId, {
        onNone: () => DeleteSectionDialogBinding.requestClose()(model),
        onSome: sectionId => {
          const song = Song.removeSection(model.song, sectionId)
          return Update.withOutMessage(
            DeleteSectionDialogBinding.requestClose()(
              modifyFields(model, {
                song: () => song,
                maybePendingDeleteSectionId: () => Option.none(),
              }),
            ),
            OutMessage.UpdatedSong({ song }),
          )
        },
      }),

    ClickedDuplicateSection: ({ sectionId }) =>
      Option.match(Song.findSection(model.song, sectionId), {
        onNone: () => ({ model }),
        onSome: section => ({
          model,
          commands: [
            GenerateEditorIds({
              count: Section.duplicateIdCount(section),
              request: IdRequest.DuplicateSection({ sectionId }),
            }),
          ],
        }),
      }),

    CompletedGenerateEditorIds: handleCompletedGenerateEditorIds(model),
  }),
)

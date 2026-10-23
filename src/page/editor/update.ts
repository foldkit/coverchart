import { Array, Match, Option, String } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Line, Section, Song } from '../../domain'
import { placeChord } from './chordPlacement'
import { GenerateEditorIds } from './command'
import {
  ChordMenuBinding,
  DeleteSectionDialogBinding,
  EditorComposition,
} from './composition'
import { IdRequest, Message, OutMessage } from './message'
import { EditorMode, Model } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  typeof Model.Type,
  typeof Message.Type,
  typeof OutMessage.Type
>

const handleGeneratedIds = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  ids: ReadonlyArray<string>,
  request: typeof IdRequest.Type,
) =>
  IdRequest.match<UpdateReturn>(request, {
    NewSection: ({ kind }) =>
      Option.match(Array.head(ids), {
        onNone: () => ({ model }),
        onSome: id => ({
          model,
          outMessage: OutMessage.AddedSection({
            section: Section.empty(id, kind),
          }),
        }),
      }),
    DuplicateSection: ({ sectionId }) =>
      Option.match(Song.findSection(song, sectionId), {
        onNone: () => ({ model }),
        onSome: section =>
          Option.match(Section.duplicate(section, ids), {
            onNone: () => ({ model }),
            onSome: duplicated => ({
              model,
              outMessage: OutMessage.DuplicatedSection({
                afterSectionId: sectionId,
                section: duplicated,
              }),
            }),
          }),
      }),
    NewMark: ({ lineId, at, name, expectedLyric }) =>
      Option.match(Song.findLine(song, lineId), {
        onNone: () => ({ model }),
        onSome: line =>
          line.lyric !== expectedLyric
            ? { model }
            : Option.match(Array.head(ids), {
                onNone: () => ({ model }),
                onSome: id => ({
                  model: modifyFields(model, {
                    mode: () => EditorMode.Viewing(),
                  }),
                  outMessage: OutMessage.PlacedChord({
                    lineId,
                    mark: { id, at, name },
                  }),
                }),
              }),
      }),
  })

export const update = EditorComposition.makeUpdate(
  (model, message, maybeSong: Option.Option<typeof Song.Song.Type>) =>
    Option.match(maybeSong, {
      onNone: () => ({ model }),
      onSome: song =>
        Message.match(message, {
          UpdatedTitle: ({ value }) => ({
            model,
            outMessage: OutMessage.UpdatedTitle({ value }),
          }),
          UpdatedArtist: ({ value }) => ({
            model,
            outMessage: OutMessage.UpdatedArtist({ value }),
          }),
          UpdatedOriginalKey: ({ value }) => ({
            model,
            outMessage: OutMessage.UpdatedOriginalKey({ value }),
          }),
          ClickedEditLyrics: ({ sectionId }) =>
            Option.match(Song.findSection(song, sectionId), {
              onNone: () => ({ model }),
              onSome: section =>
                ChordMenuBinding.requestClose()(
                  modifyFields(model, {
                    mode: () =>
                      EditorMode.EditingLyrics({
                        sectionId,
                        backupLines: section.lines,
                      }),
                  }),
                ),
            }),
          UpdatedLyricsDraft: ({ value }) =>
            EditorMode.match<UpdateReturn>(model.mode, {
              Viewing: () => ({ model }),
              PlacingChord: () => ({ model }),
              EditingLyrics: editing => ({
                model,
                outMessage: OutMessage.UpdatedLyrics({
                  sectionId: editing.sectionId,
                  draft: value,
                }),
              }),
            }),
          ClickedSaveLyrics: () => ({
            model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
          }),
          ClickedCancelLyrics: () =>
            EditorMode.match<UpdateReturn>(model.mode, {
              Viewing: () => ({ model }),
              PlacingChord: () => ({
                model: modifyFields(model, {
                  mode: () => EditorMode.Viewing(),
                }),
              }),
              EditingLyrics: ({ sectionId, backupLines }) => ({
                model: modifyFields(model, {
                  mode: () => EditorMode.Viewing(),
                }),
                outMessage: OutMessage.RestoredLyrics({
                  sectionId,
                  lines: backupLines,
                }),
              }),
            }),
          ClickedWord: ({ lineId, at }) =>
            Option.match(Song.findLine(song, lineId), {
              onNone: () => ({ model }),
              onSome: line => {
                const maybeMark = Line.markAt(line, at)
                return ChordMenuBinding.requestOpen()(
                  modifyFields(model, {
                    mode: () =>
                      EditorMode.PlacingChord({
                        lineId,
                        expectedLyric: line.lyric,
                        at,
                        maybeMarkId: Option.map(maybeMark, ({ id }) => id),
                      }),
                  }),
                )
              },
            }),

          UpdatedPaletteDraft: ({ value }) => ({
            model: modifyFields(model, { paletteDraft: () => value }),
          }),
          SubmittedPaletteChord: () => {
            const name = model.paletteDraft.trim()
            const nextModel = modifyFields(model, { paletteDraft: () => '' })

            if (String.isEmpty(name)) {
              return { model: nextModel }
            }

            return Match.value(model.mode).pipe(
              Match.tag('PlacingChord', () => placeChord(name)(nextModel)),
              Match.orElse(() => ({
                model: nextModel,
                outMessage: OutMessage.AddedChord({ name }),
              })),
            )
          },
          ClickedRemovePaletteChord: ({ name }) => ({
            model,
            outMessage: OutMessage.RemovedChord({ name }),
          }),
          ClickedRemoveSection: ({ sectionId }) => {
            if (song.sections.length < 2) {
              return { model }
            }

            return DeleteSectionDialogBinding.requestOpen()(
              modifyFields(model, {
                maybePendingDeleteSectionId: () => Option.some(sectionId),
              }),
            )
          },
          ClickedConfirmRemoveSection: () =>
            Option.match(model.maybePendingDeleteSectionId, {
              onNone: () => DeleteSectionDialogBinding.requestClose()(model),
              onSome: sectionId =>
                Update.withOutMessage(
                  DeleteSectionDialogBinding.requestClose()(
                    modifyFields(model, {
                      maybePendingDeleteSectionId: () => Option.none(),
                    }),
                  ),
                  OutMessage.RemovedSection({ sectionId }),
                ),
            }),
          ClickedDuplicateSection: ({ sectionId }) =>
            Option.match(Song.findSection(song, sectionId), {
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
          CompletedGenerateEditorIds: ({ ids, request }) =>
            handleGeneratedIds(model, song, ids, request),
        }),
    }),
)

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
import {
  makeCommandsStep,
  makeFieldsStep,
  makeNoopStep,
  makeOutMessageStep,
  makeStep,
} from './definition'
import { IdRequest, Message, OutMessage } from './message'
import { EditorMode, Model } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  typeof Model.Type,
  typeof Message.Type,
  typeof OutMessage.Type
>

const handleGeneratedIdsStep = makeStep(
  (
    model,
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
    }),
)

export const update = EditorComposition.makeUpdate.withContext(
  (maybeSong: Option.Option<typeof Song.Song.Type>) => {
    const withSong = <Result>(
      model: typeof Model.Type,
      onSome: (song: typeof Song.Song.Type) => Result,
    ) =>
      Option.match(maybeSong, {
        onNone: () => makeNoopStep()(model),
        onSome,
      })

    return {
      UpdatedTitle: (model, { value }) =>
        withSong(model, () =>
          makeOutMessageStep(() => OutMessage.UpdatedTitle({ value }))(model),
        ),
      UpdatedArtist: (model, { value }) =>
        withSong(model, () =>
          makeOutMessageStep(() => OutMessage.UpdatedArtist({ value }))(model),
        ),
      UpdatedOriginalKey: (model, { value }) =>
        withSong(model, () =>
          makeOutMessageStep(() => OutMessage.UpdatedOriginalKey({ value }))(
            model,
          ),
        ),
      ClickedEditLyrics: (model, { sectionId }) =>
        withSong(model, song =>
          Option.match(Song.findSection(song, sectionId), {
            onNone: () => makeNoopStep()(model),
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
        ),
      UpdatedLyricsDraft: (model, { value }) =>
        withSong(model, () =>
          makeStep(stepModel =>
            EditorMode.match<UpdateReturn>(stepModel.mode, {
              Viewing: () => ({ model: stepModel }),
              PlacingChord: () => ({ model: stepModel }),
              EditingLyrics: editing => ({
                model: stepModel,
                outMessage: OutMessage.UpdatedLyrics({
                  sectionId: editing.sectionId,
                  draft: value,
                }),
              }),
            }),
          )(model),
        ),
      ClickedSaveLyrics: model =>
        withSong(model, () =>
          makeFieldsStep(() => ({
            mode: () => EditorMode.Viewing(),
          }))(model),
        ),
      ClickedCancelLyrics: model =>
        withSong(model, () =>
          makeStep(stepModel =>
            EditorMode.match<UpdateReturn>(stepModel.mode, {
              Viewing: () => ({ model: stepModel }),
              PlacingChord: () => ({
                model: modifyFields(stepModel, {
                  mode: () => EditorMode.Viewing(),
                }),
              }),
              EditingLyrics: ({ sectionId, backupLines }) => ({
                model: modifyFields(stepModel, {
                  mode: () => EditorMode.Viewing(),
                }),
                outMessage: OutMessage.RestoredLyrics({
                  sectionId,
                  lines: backupLines,
                }),
              }),
            }),
          )(model),
        ),
      ClickedWord: (model, { lineId, at }) =>
        withSong(model, song =>
          Option.match(Song.findLine(song, lineId), {
            onNone: () => makeNoopStep()(model),
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
        ),

      UpdatedPaletteDraft: (model, { value }) =>
        withSong(model, () =>
          makeFieldsStep(() => ({
            paletteDraft: () => value,
          }))(model),
        ),
      SubmittedPaletteChord: model =>
        withSong(model, () => {
          const name = model.paletteDraft.trim()
          const nextModel = modifyFields(model, { paletteDraft: () => '' })

          if (String.isEmpty(name)) {
            return makeNoopStep()(nextModel)
          }

          return Match.value(model.mode).pipe(
            Match.tag('PlacingChord', () => placeChord(name)(nextModel)),
            Match.orElse(() =>
              makeOutMessageStep(() => OutMessage.AddedChord({ name }))(
                nextModel,
              ),
            ),
          )
        }),
      ClickedRemovePaletteChord: (model, { name }) =>
        withSong(model, () =>
          makeOutMessageStep(() => OutMessage.RemovedChord({ name }))(model),
        ),
      ClickedRemoveSection: (model, { sectionId }) =>
        withSong(model, song => {
          if (song.sections.length < 2) {
            return makeNoopStep()(model)
          }

          return DeleteSectionDialogBinding.requestOpen()(
            modifyFields(model, {
              maybePendingDeleteSectionId: () => Option.some(sectionId),
            }),
          )
        }),
      ClickedConfirmRemoveSection: model =>
        withSong(model, () =>
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
        ),
      ClickedDuplicateSection: (model, { sectionId }) =>
        withSong(model, song =>
          Option.match(Song.findSection(song, sectionId), {
            onNone: () => makeNoopStep()(model),
            onSome: section =>
              makeCommandsStep(() => [
                GenerateEditorIds({
                  count: Section.duplicateIdCount(section),
                  request: IdRequest.DuplicateSection({ sectionId }),
                }),
              ])(model),
          }),
        ),
      CompletedGenerateEditorIds: (model, { ids, request }) =>
        withSong(model, song =>
          handleGeneratedIdsStep(model, song, ids, request),
        ),
    }
  },
)

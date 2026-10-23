import { Option } from 'effect'
import type { Block } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { DialogBlock, DragAndDropBlock } from '@foldkit/ui'
import type { InitConfig as DragAndDropInitConfig } from '@foldkit/ui/dragAndDrop'

import {
  CHORD_MENU_CLEAR,
  CHORD_MENU_EMPTY,
  CHORD_MENU_ID,
} from '../../constant'
import { Line, Section, Song } from '../../domain'
import { GenerateEditorIds } from './command'
import { EditorDefinition } from './definition'
import { AddSectionMenuBlock, ChordMenuBlock } from './menu'
import { IdRequest, OutMessage } from './message'
import { EditorMode } from './model'

const foldAddSectionMenuOutMessage = EditorDefinition.makeOutMessageFold(
  AddSectionMenuBlock,
  {
    Selected: ({ value }) =>
      EditorDefinition.makeStep(model => ({
        model,
        commands: [
          GenerateEditorIds({
            count: 1,
            request: IdRequest.NewSection({ kind: value }),
          }),
        ],
      })),
    Closed: EditorDefinition.makeNoopStep,
  },
)

export const AddSectionMenuBinding = EditorDefinition.makeBinding(
  AddSectionMenuBlock,
  {
    field: 'addSectionMenu',
    init: { contextToArgs: () => [{ id: 'add-section-menu' }] },
  },
).withOutMessagePolicy({ fold: foldAddSectionMenuOutMessage })

const followChordMenuSelection = (item: string) =>
  EditorDefinition.makeStep(model =>
    EditorMode.match(model.mode, {
      Viewing: () => ({ model }),
      EditingLyrics: () => ({ model }),
      PlacingChord: placing => {
        if (item === CHORD_MENU_EMPTY) {
          return {
            model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
          }
        }

        const name = item === CHORD_MENU_CLEAR ? '' : item

        if (name === '') {
          return Option.match(placing.maybeMarkId, {
            onNone: () => ({
              model: modifyFields(model, { mode: () => EditorMode.Viewing() }),
            }),
            onSome: markId => {
              const song = Song.updateLine(model.song, placing.lineId, line =>
                Line.removeMark(line, markId),
              )
              return {
                model: modifyFields(model, {
                  song: () => song,
                  mode: () => EditorMode.Viewing(),
                }),
                outMessage: OutMessage.UpdatedSong({ song }),
              }
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
            return {
              model: modifyFields(model, {
                song: () => song,
                mode: () => EditorMode.Viewing(),
              }),
              outMessage: OutMessage.UpdatedSong({ song }),
            }
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
      },
    }),
  )

const foldChordMenuOutMessage = EditorDefinition.makeOutMessageFold(
  ChordMenuBlock,
  {
    Selected: ({ value }) => followChordMenuSelection(value),
    Closed: () =>
      EditorDefinition.makeStep(model => ({
        model:
          model.mode._tag === 'PlacingChord'
            ? modifyFields(model, { mode: () => EditorMode.Viewing() })
            : model,
      })),
  },
)

export const ChordMenuBinding = EditorDefinition.makeBinding(ChordMenuBlock, {
  field: 'chordMenu',
  init: { contextToArgs: () => [{ id: CHORD_MENU_ID }] },
}).withOutMessagePolicy({ fold: foldChordMenuOutMessage })

const foldDragAndDropOutMessage = EditorDefinition.makeOutMessageFold(
  DragAndDropBlock,
  {
    Reordered:
      ({ itemId, toIndex }) =>
      model => {
        const song = Song.reorderSections(model.song, itemId, toIndex)
        const kind = Option.match(Song.findSection(song, itemId), {
          onNone: () => 'Section',
          onSome: section => Section.kindLabel(section.kind),
        })
        return {
          model: modifyFields(model, {
            song: () => song,
            announcement: () =>
              `${kind} moved to position ${globalThis.String(toIndex + 1)}.`,
          }),
          outMessage: OutMessage.UpdatedSong({ song }),
        }
      },
    Cancelled: () => model => ({
      model: modifyFields(model, {
        announcement: () => 'Section move cancelled.',
      }),
    }),
  },
)

const sectionDragAndDropConfig: DragAndDropInitConfig = {
  id: 'section-dnd',
  orientation: 'Vertical',
}

export const SectionDragAndDropBinding = EditorDefinition.makeBinding(
  DragAndDropBlock,
  {
    field: 'sectionDragAndDrop',
    init: {
      contextToArgs: () => [sectionDragAndDropConfig],
    },
  },
).withOutMessagePolicy({ fold: foldDragAndDropOutMessage })

const foldDeleteSectionDialogOutMessage = EditorDefinition.makeOutMessageFold(
  DialogBlock,
  {
    Opened: EditorDefinition.makeNoopStep,
    Closed: () =>
      EditorDefinition.makeFieldsStep(() => ({
        maybePendingDeleteSectionId: () => Option.none(),
      })),
    CompletedClose: EditorDefinition.makeNoopStep,
  },
)

export const DeleteSectionDialogBinding = EditorDefinition.makeBinding(
  DialogBlock,
  {
    field: 'deleteSectionDialog',
    init: { contextToArgs: () => [{ id: 'delete-section-dialog' }] },
  },
).withOutMessagePolicy({ fold: foldDeleteSectionDialogOutMessage })

export const EditorComposition = EditorDefinition.makeComposition({
  bindings: [
    AddSectionMenuBinding,
    ChordMenuBinding,
    SectionDragAndDropBinding,
    DeleteSectionDialogBinding,
  ],
})
export type EditorViewBuilder = Block.ViewBuilderFor<typeof EditorComposition>

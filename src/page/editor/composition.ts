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
import { placeChord } from './chordPlacement'
import { GenerateEditorIds } from './command'
import {
  EditorDefinition,
  makeFieldsStep,
  makeNoopStep,
  makeStep,
} from './definition'
import { AddSectionMenuBlock, ChordMenuBlock } from './menu'
import { IdRequest, OutMessage } from './message'
import { Announcement, EditorMode } from './model'

const foldAddSectionMenuOutMessage = EditorDefinition.makeOutMessageFold(
  AddSectionMenuBlock,
  {
    Selected: ({ value }) =>
      makeStep(model => ({
        model,
        commands: [
          GenerateEditorIds({
            count: 1,
            request: IdRequest.NewSection({ kind: value }),
          }),
        ],
      })),
    Closed: makeNoopStep,
  },
)

export const AddSectionMenuBinding = EditorDefinition.makeBinding(
  AddSectionMenuBlock,
  {
    field: 'addSectionMenu',
    init: { contextToArgs: () => [{ id: 'add-section-menu' }] },
  },
).withOutMessagePolicy({ fold: foldAddSectionMenuOutMessage })

const foldChordMenuOutMessage = EditorDefinition.makeOutMessageFold(
  ChordMenuBlock,
  {
    Selected: ({ value }) =>
      value === CHORD_MENU_EMPTY
        ? makeFieldsStep(() => ({
            mode: () => EditorMode.Viewing(),
          }))
        : placeChord(value === CHORD_MENU_CLEAR ? '' : value),
    Closed: () =>
      makeStep(model => ({
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
    StartedKeyboardDrag: makeNoopStep,
    ChangedKeyboardTarget: makeNoopStep,
    Reordered: ({ itemId, toIndex }) =>
      makeStep(model => ({
        model: modifyFields(model, {
          announcement: () =>
            Announcement.Reordered({ sectionId: itemId, toIndex }),
        }),
        outMessage: OutMessage.ReorderedSection({ sectionId: itemId, toIndex }),
      })),
    Cancelled: () =>
      makeFieldsStep(() => ({
        announcement: () => Announcement.Cancelled(),
      })),
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
    Opened: makeNoopStep,
    Closed: () =>
      makeFieldsStep(() => ({
        maybePendingDeleteSectionId: () => Option.none(),
      })),
    CompletedClose: makeNoopStep,
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

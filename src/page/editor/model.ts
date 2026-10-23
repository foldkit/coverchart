import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DialogBlock, DragAndDropBlock } from '@foldkit/ui'

import { Line } from '../../domain'
import { AddSectionMenuBlock, ChordMenuBlock } from './menu'

export const EditorMode = defineTaggedUnion({
  Viewing: {},
  EditingLyrics: {
    sectionId: Schema.String,
    backupLines: Schema.Array(Line.LyricLine),
  },
  PlacingChord: {
    lineId: Schema.String,
    expectedLyric: Schema.String,
    at: Schema.Number,
    maybeMarkId: Schema.Option(Schema.String),
  },
})
export const Announcement = defineTaggedUnion({
  None: {},
  Reordered: { sectionId: Schema.String, toIndex: Schema.Number },
  Cancelled: {},
})

export const Model = Schema.Struct({
  mode: EditorMode,
  paletteDraft: Schema.String,
  addSectionMenu: AddSectionMenuBlock.Model,
  chordMenu: ChordMenuBlock.Model,
  sectionDragAndDrop: DragAndDropBlock.Model,
  deleteSectionDialog: DialogBlock.Model,
  maybePendingDeleteSectionId: Schema.Option(Schema.String),
  announcement: Announcement,
})

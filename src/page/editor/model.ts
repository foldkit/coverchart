import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DialogBlock, DragAndDropBlock } from '@foldkit/ui'

import { PLACEHOLDER_SECTION_ID, PLACEHOLDER_SONG_ID } from '../../constant'
import { Line, Song } from '../../domain'
import { AddSectionMenuBlock, ChordMenuBlock } from './menu'

export const EditorMode = defineTaggedUnion({
  Viewing: {},
  EditingLyrics: {
    sectionId: Schema.String,
    draft: Schema.String,
    backupLines: Schema.Array(Line.LyricLine),
  },
  PlacingChord: {
    lineId: Schema.String,
    at: Schema.Number,
    maybeMarkId: Schema.Option(Schema.String),
  },
})
export type PlacingChord = typeof EditorMode.PlacingChord.Type
export type EditorMode = typeof EditorMode.Type

export const Model = Schema.Struct({
  song: Song.Song,
  mode: EditorMode,
  paletteDraft: Schema.String,
  addSectionMenu: AddSectionMenuBlock.Model,
  chordMenu: ChordMenuBlock.Model,
  sectionDragAndDrop: DragAndDropBlock.Model,
  deleteSectionDialog: DialogBlock.Model,
  maybePendingDeleteSectionId: Schema.Option(Schema.String),
  announcement: Schema.String,
})

export type Model = typeof Model.Type

export const placeholderSong = Song.create(
  PLACEHOLDER_SONG_ID,
  PLACEHOLDER_SECTION_ID,
)

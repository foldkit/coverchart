import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { Section, Song } from '../../domain'

export const IdRequest = defineTaggedUnion({
  NewSection: { kind: Section.SectionKind },
  DuplicateSection: { sectionId: Schema.String },
  NewMark: {
    lineId: Schema.String,
    at: Schema.Number,
    name: Schema.String,
  },
})
export type IdRequest = typeof IdRequest.Type

export const Message = defineMessageUnion({
  InformedOfSongChange: { song: Song.Song },
  UpdatedTitle: { value: Schema.String },
  UpdatedArtist: { value: Schema.String },
  UpdatedOriginalKey: { value: Schema.String },
  ClickedEditLyrics: { sectionId: Schema.String },
  UpdatedLyricsDraft: { value: Schema.String },
  ClickedSaveLyrics: {},
  ClickedCancelLyrics: {},
  ClickedWord: { lineId: Schema.String, at: Schema.Number },
  UpdatedPaletteDraft: { value: Schema.String },
  SubmittedPaletteChord: {},
  ClickedRemovePaletteChord: { name: Schema.String },
  ClickedRemoveSection: { sectionId: Schema.String },
  ClickedConfirmRemoveSection: {},
  ClickedDuplicateSection: { sectionId: Schema.String },
  CompletedGenerateEditorIds: {
    ids: Schema.Array(Schema.String),
    request: IdRequest,
  },
})
export type Message = typeof Message.Type

// OUT MESSAGE

export const OutMessage = defineMessageUnion({
  UpdatedSong: { song: Song.Song },
})
export type OutMessage = typeof OutMessage.Type

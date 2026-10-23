import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { Line, Section } from '../../domain'

export const IdRequest = defineTaggedUnion({
  NewSection: { kind: Section.SectionKind },
  DuplicateSection: { sectionId: Schema.String },
  NewMark: {
    lineId: Schema.String,
    expectedLyric: Schema.String,
    at: Schema.Number,
    name: Schema.String,
  },
})

export const Message = defineMessageUnion({
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

export const OutMessage = defineMessageUnion({
  UpdatedTitle: { value: Schema.String },
  UpdatedArtist: { value: Schema.String },
  UpdatedOriginalKey: { value: Schema.String },
  UpdatedLyrics: { sectionId: Schema.String, draft: Schema.String },
  RestoredLyrics: {
    sectionId: Schema.String,
    lines: Schema.Array(Line.LyricLine),
  },
  AddedChord: { name: Schema.String },
  RemovedChord: { name: Schema.String },
  PlacedChord: { lineId: Schema.String, mark: Line.ChordMark },
  RenamedChord: {
    lineId: Schema.String,
    markId: Schema.String,
    name: Schema.String,
  },
  ClearedChord: { lineId: Schema.String, markId: Schema.String },
  AddedSection: { section: Section.Section },
  DuplicatedSection: {
    afterSectionId: Schema.String,
    section: Section.Section,
  },
  RemovedSection: { sectionId: Schema.String },
  ReorderedSection: { sectionId: Schema.String, toIndex: Schema.Number },
})

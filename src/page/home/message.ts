import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

export const Message = defineMessageUnion({
  UpdatedSearchQuery: { value: Schema.String },
  ClickedNewSong: {},
  ClickedDeleteSong: { songId: Schema.String },
  ClickedConfirmDelete: {},
})

// OUT MESSAGE

export const OutMessage = defineMessageUnion({
  RequestedNewSong: {},
  ConfirmedDeleteSong: { songId: Schema.String },
})

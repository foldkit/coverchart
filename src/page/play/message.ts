import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Song } from '../../domain'

export const Message = defineMessageUnion({
  InformedOfSongChange: { song: Song.Song },
  ClickedTransposeDown: {},
  ClickedTransposeUp: {},
  ClickedCapoDown: {},
  ClickedCapoUp: {},
  ClickedCopyChart: {},
  SucceededCopyChart: {},
  FailedCopyChart: { error: Schema.String },
})
export type Message = typeof Message.Type

// OUT MESSAGE

export const OutMessage = defineMessageUnion({
  UpdatedSong: { song: Song.Song },
  CopiedChart: {},
  FailedCopy: { error: Schema.String },
})
export type OutMessage = typeof OutMessage.Type

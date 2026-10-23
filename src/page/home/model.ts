import { Schema } from 'effect'

import { DialogBlock } from '@foldkit/ui'

export const Model = Schema.Struct({
  searchQuery: Schema.String,
  deleteDialog: DialogBlock.Model,
  maybePendingDeleteSongId: Schema.Option(Schema.String),
})

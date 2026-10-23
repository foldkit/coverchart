import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

export const Message = defineMessageUnion({
  ClickedTransposeDown: {},
  ClickedTransposeUp: {},
  ClickedCapoDown: {},
  ClickedCapoUp: {},
  ClickedCopyChart: {},
  SucceededCopyChart: {},
  FailedCopyChart: { error: Schema.String },
})

// OUT MESSAGE

export const OutMessage = defineMessageUnion({
  AdjustedTranspose: { by: Schema.Number },
  AdjustedCapo: { by: Schema.Number },
  CopiedChart: {},
  FailedCopy: { error: Schema.String },
})

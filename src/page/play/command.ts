import { Effect, Schema } from 'effect'

import { PlayDefinition } from './definition'
import { Message } from './message'

export const CopyChart = PlayDefinition.makeCommand('CopyChart', {
  args: { text: Schema.String },
  messages: [Message.SucceededCopyChart, Message.FailedCopyChart],
  handler: function* () {
    return ({ text }) =>
      Effect.tryPromise({
        try: () => navigator.clipboard.writeText(text),
        catch: () => new Error('Failed to copy to clipboard'),
      }).pipe(
        Effect.as(Message.SucceededCopyChart()),
        Effect.catch(() =>
          Effect.succeed(
            Message.FailedCopyChart({ error: 'Could not copy the chart.' }),
          ),
        ),
      )
  },
})

export const EffectsLayer = CopyChart.layer

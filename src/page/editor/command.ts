import { Array, Crypto, Effect, Schema } from 'effect'

import { EditorDefinition } from './definition'
import { IdRequest, Message } from './message'

export const GenerateEditorIds = EditorDefinition.makeCommand(
  'GenerateEditorIds',
  {
    args: { count: Schema.Number, request: IdRequest },
    messages: [Message.CompletedGenerateEditorIds],
    handler: function* () {
      const crypto = yield* Crypto.Crypto

      return ({ count, request }) =>
        Effect.gen(function* () {
          const ids = yield* Effect.all(
            Array.makeBy(count, () => Effect.orDie(crypto.randomUUIDv4)),
          )
          return Message.CompletedGenerateEditorIds({ ids, request })
        })
    },
  },
)

export const EffectsLayer = GenerateEditorIds.layer

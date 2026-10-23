import { Effect, Option, Queue, Schema, Stream } from 'effect'

import { ApplicationDefinition } from './definition'
import { Message } from './message'

export const subscriptions = ApplicationDefinition.makeSubscriptions(entry => ({
  systemTheme: entry(
    'SystemTheme',
    { isSystemPreference: Schema.Boolean },
    {
      messages: [Message.ChangedSystemTheme],
      modelToDependencies: model => ({
        isSystemPreference: Option.exists(
          model.maybeThemePreference,
          preference => preference === 'System',
        ),
      }),
      handler: function* () {
        return ({ isSystemPreference }) =>
          Stream.when(
            Stream.callback<typeof Message.ChangedSystemTheme.Type>(queue =>
              Effect.acquireRelease(
                Effect.sync(() => {
                  const mediaQuery = window.matchMedia(
                    '(prefers-color-scheme: dark)',
                  )
                  const handler = (event: MediaQueryListEvent) => {
                    Queue.offerUnsafe(
                      queue,
                      Message.ChangedSystemTheme({
                        theme: event.matches ? 'Dark' : 'Light',
                      }),
                    )
                  }
                  mediaQuery.addEventListener('change', handler)
                  return { mediaQuery, handler }
                }),
                ({ mediaQuery, handler }) =>
                  Effect.sync(() =>
                    mediaQuery.removeEventListener('change', handler),
                  ),
              ).pipe(Effect.flatMap(() => Effect.never)),
            ),
            Effect.sync(() => isSystemPreference),
          )
      },
    },
  ),
}))

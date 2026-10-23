import { Match } from 'effect'

import type { ResolvedTheme, ThemePreference } from './message'

export const resolveTheme = (
  preference: typeof ThemePreference.Type,
  systemTheme: typeof ResolvedTheme.Type,
): typeof ResolvedTheme.Type =>
  Match.value(preference).pipe(
    Match.withReturnType<typeof ResolvedTheme.Type>(),
    Match.when('Dark', () => 'Dark'),
    Match.when('Light', () => 'Light'),
    Match.when('System', () => systemTheme),
    Match.exhaustive,
  )

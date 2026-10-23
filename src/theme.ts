import { Match } from 'effect'

import type { ResolvedTheme, ThemePreference } from './message'

export const resolveTheme = (
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme =>
  Match.value(preference).pipe(
    Match.withReturnType<ResolvedTheme>(),
    Match.when('Dark', () => 'Dark'),
    Match.when('Light', () => 'Light'),
    Match.when('System', () => systemTheme),
    Match.exhaustive,
  )

import clsx from 'clsx'
import { Option } from 'effect'
import type { Html } from 'foldkit/html'

import type { ApplicationViewBuilder } from '../composition'
import { Message, type ThemePreference } from '../message'
import { computer, moon, sun } from './icon'

export const themeSelector = (
  maybeActivePreference: Option.Option<ThemePreference>,
  h: ApplicationViewBuilder,
): Html =>
  h.div(
    [
      h.Role('group'),
      h.AriaLabel('Theme preference'),
      h.Class(
        'flex items-center gap-0.5 rounded-lg border border-stone-300 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-800',
      ),
    ],
    [
      themeSelectorButton(
        'Light',
        maybeActivePreference,
        sun('w-4 h-4'),
        'Light mode',
        h,
      ),
      themeSelectorButton(
        'System',
        maybeActivePreference,
        computer('w-4 h-4'),
        'System mode',
        h,
      ),
      themeSelectorButton(
        'Dark',
        maybeActivePreference,
        moon('w-4 h-4'),
        'Dark mode',
        h,
      ),
    ],
  )

const themeSelectorButton = (
  preference: ThemePreference,
  maybeActivePreference: Option.Option<ThemePreference>,
  icon: Html,
  label: string,
  h: ApplicationViewBuilder,
) => {
  const isActive = Option.exists(
    maybeActivePreference,
    activePreference => activePreference === preference,
  )

  return h.button(
    [
      h.AriaPressed(isActive.toString()),
      h.Class(
        clsx(
          'cursor-pointer rounded-md p-2 transition',
          isActive
            ? 'bg-stone-300 text-stone-900 dark:bg-stone-600 dark:text-white'
            : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200',
        ),
      ),
      h.AriaLabel(label),
      h.OnClick(Message.SelectedThemePreference({ preference })),
    ],
    [icon],
  )
}

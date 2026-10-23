import { Array, Option, String, pipe } from 'effect'
import type { Html } from 'foldkit/html'

import { Button } from '@foldkit/ui'

import { Song } from '../../domain'
import { homeRouter, songEditRouter } from '../../route'
import * as className from '../../view/className'
import { PlayComposition, type PlayViewBuilder } from './composition'
import { Message } from './message'

const formatSigned = (value: number): string =>
  value > 0 ? `+${globalThis.String(value)}` : globalThis.String(value)

const metaLineView = (
  song: typeof Song.Song.Type,
  h: PlayViewBuilder,
): Html => {
  const keyText = Option.match(song.maybeOriginalKey, {
    onNone: () => '',
    onSome: key => `Key ${key}`,
  })
  const parts = pipe(
    [
      String.isNonEmpty(song.artist) ? song.artist : '',
      keyText,
      song.capo > 0 ? `Capo ${globalThis.String(song.capo)}` : '',
      song.transpose !== 0 ? `Transpose ${formatSigned(song.transpose)}` : '',
    ],
    Array.filter(String.isNonEmpty),
  )

  return Array.match(parts, {
    onEmpty: () => h.empty,
    onNonEmpty: items =>
      h.p(
        [h.Class('text-sm text-stone-500 dark:text-stone-400')],
        [Array.join(items, ' · ')],
      ),
  })
}

const controlsView = (h: PlayViewBuilder): Html =>
  h.div(
    [h.Class('flex flex-wrap gap-2')],
    [
      Button.view(
        {
          onClick: Message.ClickedTransposeDown(),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.secondaryButton)],
              ['Transpose down'],
            ),
        },
        h,
      ),
      Button.view(
        {
          onClick: Message.ClickedTransposeUp(),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.secondaryButton)],
              ['Transpose up'],
            ),
        },
        h,
      ),
      Button.view(
        {
          onClick: Message.ClickedCapoDown(),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.secondaryButton)],
              ['Capo down'],
            ),
        },
        h,
      ),
      Button.view(
        {
          onClick: Message.ClickedCapoUp(),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.secondaryButton)],
              ['Capo up'],
            ),
        },
        h,
      ),
      Button.view(
        {
          onClick: Message.ClickedCopyChart(),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.primaryButton)],
              ['Copy chart'],
            ),
        },
        h,
      ),
    ],
  )

type ViewInputs = Readonly<{ song: typeof Song.Song.Type }>

export const view = PlayComposition.makeView.withInputs<ViewInputs>(
  (_model, { song }, h) =>
    h.main(
      [h.Class('flex flex-col gap-8')],
      [
        h.header(
          [h.Class('flex flex-col gap-4')],
          [
            h.div(
              [h.Class('flex flex-wrap items-center justify-between gap-3')],
              [
                h.h1([h.Class(className.heading)], [Song.displayTitle(song)]),
                h.div(
                  [h.Class('flex flex-wrap gap-2')],
                  [
                    h.a(
                      [h.Href(homeRouter()), h.Class(className.quietButton)],
                      ['Library'],
                    ),
                    h.a(
                      [
                        h.Href(songEditRouter({ songId: song.id })),
                        h.Class(className.secondaryButton),
                      ],
                      ['Edit'],
                    ),
                  ],
                ),
              ],
            ),
            metaLineView(song, h),
            controlsView(h),
          ],
        ),
        h.pre(
          [
            h.Class(
              'overflow-x-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-6 font-mono text-base leading-7 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
            ),
            h.AriaLabel('Chord chart'),
          ],
          [Song.toChartText(song)],
        ),
      ],
    ),
)

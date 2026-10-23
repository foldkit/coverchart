import { Array, Match, Option, String } from 'effect'
import type { Html } from 'foldkit/html'
import { childAttributes } from 'foldkit/html'

import { Button } from '@foldkit/ui'
import type { AnchorConfig } from '@foldkit/ui/menu'

import { CHORD_MENU_CLEAR, CHORD_MENU_EMPTY } from '../../constant'
import { Line } from '../../domain'
import * as className from '../../view/className'
import { ChordMenuBinding, type EditorViewBuilder } from './composition'
import { Message } from './message'
import type { Model, PlacingChord } from './model'

const MENU_ANCHOR: AnchorConfig = {
  placement: 'bottom-start',
  gap: 4,
  padding: 8,
}

const isPlacingOnWord = (
  maybePlacing: Option.Option<PlacingChord>,
  lineId: string,
  at: number,
): boolean =>
  Option.exists(
    maybePlacing,
    placing => placing.lineId === lineId && placing.at === at,
  )

const chordMenuItems = (
  chords: ReadonlyArray<string>,
  hasMark: boolean,
): ReadonlyArray<string> =>
  Array.match(chords, {
    onEmpty: () => [CHORD_MENU_EMPTY],
    onNonEmpty: names =>
      hasMark ? Array.append(names, CHORD_MENU_CLEAR) : names,
  })

const chordSlotView = (
  line: Line.LyricLine,
  word: Line.Word,
  maybePlacing: Option.Option<PlacingChord>,
  h: EditorViewBuilder,
): Html => {
  if (isPlacingOnWord(maybePlacing, line.id, word.start)) {
    return Option.match(Line.markAt(line, word.start), {
      onNone: () => h.div([h.Class('min-h-7')]),
      onSome: ({ name }) =>
        h.div(
          [h.Class('min-h-7 font-semibold text-amber-800 dark:text-amber-300')],
          [name],
        ),
    })
  }

  const maybeMark = Line.markAt(line, word.start)

  return Option.match(maybeMark, {
    onNone: () => h.div([h.Class('min-h-7')]),
    onSome: mark =>
      Button.view(
        {
          onClick: Message.ClickedWord({ lineId: line.id, at: word.start }),
          toView: attributes =>
            h.button(
              [
                ...attributes.button,
                h.Class(
                  'min-h-7 cursor-pointer rounded-sm px-0.5 text-left font-semibold text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:text-amber-300 dark:hover:bg-amber-950',
                ),
                h.AriaLabel(`Edit chord ${mark.name} on ${word.text}`),
              ],
              [mark.name],
            ),
        },
        h,
      ),
  })
}

const wordButtonView = (
  line: Line.LyricLine,
  word: Line.Word,
  h: EditorViewBuilder,
): Html =>
  Button.view(
    {
      onClick: Message.ClickedWord({ lineId: line.id, at: word.start }),
      toView: attributes =>
        h.button(
          [
            ...attributes.button,
            h.Class(className.wordButton),
            h.AriaLabel(`Place chord on ${word.text}`),
          ],
          [word.text],
        ),
    },
    h,
  )

const chordMenuView = (
  word: Line.Word,
  chords: ReadonlyArray<string>,
  hasMark: boolean,
  chordMenu: Model['chordMenu'],
  h: EditorViewBuilder,
): Html =>
  h.block(
    ChordMenuBinding.embedView({
      slotId: chordMenu.id,
      model: chordMenu,
      viewInputs: {
        anchor: MENU_ANCHOR,
        ariaLabel: `Choose a chord for ${word.text}`,
        items: chordMenuItems(chords, hasMark),
        isItemDisabled: item => item === CHORD_MENU_EMPTY,
        itemToConfig: item => ({
          className:
            'min-h-11 cursor-pointer px-3 py-2 text-sm font-semibold text-amber-800 data-[active]:bg-amber-50 data-[disabled]:cursor-not-allowed data-[disabled]:font-normal data-[disabled]:text-stone-500 dark:text-amber-300 dark:data-[active]:bg-amber-950 dark:data-[disabled]:text-stone-400',
          content: h.span(
            [],
            [
              item === CHORD_MENU_EMPTY
                ? 'Add chords to this song first'
                : item === CHORD_MENU_CLEAR
                  ? 'Clear'
                  : item,
            ],
          ),
        }),
        buttonContent: h.span([], [word.text]),
        buttonAttributes: childAttributes([
          h.Class(`${className.wordButton} bg-amber-100 dark:bg-amber-950`),
        ]),
        itemsAttributes: childAttributes([
          h.Class(
            'z-20 min-w-36 overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg outline-none dark:border-stone-700 dark:bg-stone-900',
          ),
        ]),
        attributes: childAttributes([h.Class('relative inline-block')]),
      },
    }),
  )

export const lineView = (
  line: Line.LyricLine,
  maybePlacing: Option.Option<PlacingChord>,
  chords: ReadonlyArray<string>,
  chordMenu: Model['chordMenu'],
  h: EditorViewBuilder,
): Html =>
  Array.match(Line.words(line.lyric), {
    onEmpty: () =>
      h.p(
        [h.Class('min-h-7 text-sm text-stone-400 dark:text-stone-500')],
        [String.isNonEmpty(line.lyric) ? line.lyric : 'Empty line'],
      ),
    onNonEmpty: words =>
      h.div(
        [h.Class('flex flex-wrap items-end gap-x-2 gap-y-1')],
        Array.map(words, word => {
          const isPlacingHere = isPlacingOnWord(
            maybePlacing,
            line.id,
            word.start,
          )

          return h.keyed('div')(
            `${line.id}-${globalThis.String(word.start)}`,
            [h.Class('flex flex-col items-start')],
            [
              chordSlotView(line, word, maybePlacing, h),
              isPlacingHere
                ? chordMenuView(
                    word,
                    chords,
                    Option.isSome(Line.markAt(line, word.start)),
                    chordMenu,
                    h,
                  )
                : wordButtonView(line, word, h),
            ],
          )
        }),
      ),
  })

export const maybePlacingChord = (model: Model): Option.Option<PlacingChord> =>
  Match.value(model.mode).pipe(
    Match.tag('PlacingChord', placing => placing),
    Match.option,
  )

export const isEditingSection = (model: Model, sectionId: string): boolean =>
  Option.exists(
    Match.value(model.mode).pipe(
      Match.tag('EditingLyrics', editing => editing),
      Match.option,
    ),
    editing => editing.sectionId === sectionId,
  )

export const lyricsDraft = (model: Model): string =>
  Match.value(model.mode).pipe(
    Match.tag('EditingLyrics', ({ draft }) => draft),
    Match.orElse(() => ''),
  )

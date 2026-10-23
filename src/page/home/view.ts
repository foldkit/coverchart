import { Array, String } from 'effect'
import type { Html } from 'foldkit/html'

import { Button } from '@foldkit/ui'

import { SEARCH_INPUT_ID } from '../../constant'
import { Song } from '../../domain'
import { songEditRouter, songPlayRouter } from '../../route'
import * as className from '../../view/className'
import { labeledInput } from '../../view/field'
import {
  DeleteDialogBinding,
  HomeComposition,
  type HomeViewBuilder,
} from './composition'
import { Message } from './message'
import { Model } from './model'

export type ViewInputs = Readonly<{
  songs: ReadonlyArray<Song.Song>
}>

const emptyLibraryView = (h: HomeViewBuilder): Html =>
  h.div(
    [
      h.Class(
        'rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center dark:border-stone-600 dark:bg-stone-900',
      ),
    ],
    [
      h.p(
        [h.Class('text-stone-600 dark:text-stone-400')],
        ['No songs yet. Start a chart and paste lyrics while you listen.'],
      ),
    ],
  )

const noMatchesView = (h: HomeViewBuilder): Html =>
  h.p(
    [h.Class('text-stone-600 dark:text-stone-400')],
    ['No songs match that search.'],
  )

const songRowView = (song: Song.Song, h: HomeViewBuilder): Html =>
  h.keyed('li')(
    song.id,
    [h.Class(className.songCard)],
    [
      h.a(
        [
          h.Href(songEditRouter({ songId: song.id })),
          h.Class(
            'text-lg font-semibold text-stone-900 hover:underline dark:text-stone-100',
          ),
        ],
        [Song.displayTitle(song)],
      ),
      String.isNonEmpty(song.artist)
        ? h.p(
            [h.Class('text-sm text-stone-500 dark:text-stone-400')],
            [song.artist],
          )
        : h.empty,
      h.div(
        [h.Class('mt-3 flex flex-wrap gap-2')],
        [
          h.a(
            [
              h.Href(songEditRouter({ songId: song.id })),
              h.Class(className.secondaryButton),
            ],
            ['Edit'],
          ),
          h.a(
            [
              h.Href(songPlayRouter({ songId: song.id })),
              h.Class(className.secondaryButton),
            ],
            ['Play'],
          ),
          Button.view(
            {
              onClick: Message.ClickedDeleteSong({ songId: song.id }),
              toView: attributes =>
                h.button(
                  [...attributes.button, h.Class(className.quietButton)],
                  ['Delete'],
                ),
            },
            h,
          ),
        ],
      ),
    ],
  )

const songListView = (
  songs: ReadonlyArray<Song.Song>,
  h: HomeViewBuilder,
): Html =>
  h.ul(
    [h.Class('flex flex-col gap-3'), h.AriaLabel('Songs')],
    Array.map(songs, song => songRowView(song, h)),
  )

const libraryBodyView = (
  allSongs: ReadonlyArray<Song.Song>,
  visibleSongs: ReadonlyArray<Song.Song>,
  h: HomeViewBuilder,
): Html =>
  Array.match(allSongs, {
    onEmpty: () => emptyLibraryView(h),
    onNonEmpty: () =>
      Array.match(visibleSongs, {
        onEmpty: () => noMatchesView(h),
        onNonEmpty: songs => songListView(songs, h),
      }),
  })

const deleteDialogView = (model: Model, h: HomeViewBuilder): Html =>
  h.block(
    DeleteDialogBinding.embedView({
      slotId: model.deleteDialog.id,
      model: model.deleteDialog,
      viewInputs: {
        toView: render =>
          h.dialog(
            [
              ...render.dialog,
              h.Class(
                'bg-transparent p-0 open:flex items-center justify-center',
              ),
            ],
            render.isVisible
              ? [
                  h.div([
                    ...render.backdrop,
                    h.Class('fixed inset-0 bg-stone-900/40 dark:bg-black/60'),
                  ]),
                  h.div(
                    [
                      ...render.panel,
                      h.Class(
                        'relative z-10 mx-auto max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-stone-900',
                      ),
                    ],
                    [
                      h.h2(
                        [
                          ...render.title,
                          h.Class(
                            'text-lg font-semibold text-stone-900 dark:text-stone-100',
                          ),
                        ],
                        ['Delete this song?'],
                      ),
                      h.p(
                        [
                          ...render.description,
                          h.Class(
                            'mt-2 text-sm text-stone-600 dark:text-stone-400',
                          ),
                        ],
                        ['This cannot be undone.'],
                      ),
                      h.div(
                        [h.Class('mt-6 flex justify-end gap-2')],
                        [
                          Button.view(
                            {
                              toView: attributes =>
                                h.button(
                                  [
                                    ...attributes.button,
                                    ...render.closeButton,
                                    h.Class(className.secondaryButton),
                                  ],
                                  ['Cancel'],
                                ),
                            },
                            h,
                          ),
                          Button.view(
                            {
                              onClick: Message.ClickedConfirmDelete(),
                              toView: attributes =>
                                h.button(
                                  [
                                    ...attributes.button,
                                    ...render.initialFocus,
                                    h.Class(className.dangerButton),
                                  ],
                                  ['Delete song'],
                                ),
                            },
                            h,
                          ),
                        ],
                      ),
                    ],
                  ),
                ]
              : [],
          ),
      },
    }),
  )

export const view = HomeComposition.makeView.withInputs<ViewInputs>(
  (model, viewInputs, h) => {
    const visibleSongs = Song.filterByQuery(viewInputs.songs, model.searchQuery)

    return h.main(
      [h.Class('flex flex-col gap-8')],
      [
        h.header(
          [
            h.Class(
              'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
            ),
          ],
          [
            h.div(
              [h.Class('flex flex-col gap-1')],
              [
                h.h1([h.Class(className.heading)], ['Coverchart']),
                h.p(
                  [h.Class(className.subheading)],
                  [
                    'Chord charts with lyrics, for songs you transcribe yourself.',
                  ],
                ),
              ],
            ),
            Button.view(
              {
                onClick: Message.ClickedNewSong(),
                toView: attributes =>
                  h.button(
                    [...attributes.button, h.Class(className.primaryButton)],
                    ['New song'],
                  ),
              },
              h,
            ),
          ],
        ),
        labeledInput(
          {
            id: SEARCH_INPUT_ID,
            labelText: 'Search songs',
            value: model.searchQuery,
            onInput: value => Message.UpdatedSearchQuery({ value }),
            placeholder: 'Title or artist',
          },
          h,
        ),
        libraryBodyView(viewInputs.songs, visibleSongs, h),
        deleteDialogView(model, h),
      ],
    )
  },
)

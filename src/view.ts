import clsx from 'clsx'
import { Match, Option } from 'effect'
import type { Html } from 'foldkit/html'

import { DragAndDrop } from '@foldkit/ui'

import {
  ApplicationComposition,
  type ApplicationViewBuilder,
  EditorBinding,
  HomeBinding,
  PlayBinding,
  ToastBinding,
} from './composition'
import { Song } from './domain'
import { Model } from './model'
import { notFoundView } from './notFoundView'
import { homeRouter } from './route'
import * as className from './view/className'
import { themeSelector } from './view/themeSelector'

const descriptionView = (
  maybeDescription: Option.Option<string>,
  h: ApplicationViewBuilder,
): Html =>
  Option.match(maybeDescription, {
    onNone: () => h.empty,
    onSome: description =>
      h.p(
        [h.Class('mt-1 text-sm text-stone-600 dark:text-stone-400')],
        [description],
      ),
  })

const toastView = (model: Model, h: ApplicationViewBuilder): Html =>
  h.block(
    ToastBinding.embedView({
      slotId: 'app-toast',
      model: model.toast,
      viewInputs: {
        position: 'BottomRight',
        ariaLabel: 'Notifications',
        entryToView: (entry, handlers) =>
          h.div(
            [
              h.Class(
                'pointer-events-auto max-w-sm rounded-md border border-stone-200 bg-white px-4 py-3 shadow-lg dark:border-stone-700 dark:bg-stone-900',
              ),
            ],
            [
              h.div(
                [h.Class('flex items-start justify-between gap-3')],
                [
                  h.div(
                    [],
                    [
                      h.p(
                        [
                          h.Class(
                            'font-medium text-stone-900 dark:text-stone-100',
                          ),
                        ],
                        [entry.payload.title],
                      ),
                      descriptionView(entry.payload.maybeDescription, h),
                    ],
                  ),
                  h.button(
                    [
                      ...handlers.dismiss,
                      h.Class(className.quietButton),
                      h.AriaLabel('Dismiss notification'),
                    ],
                    ['Dismiss'],
                  ),
                ],
              ),
            ],
          ),
      },
    }),
  )

const homePageView = (model: Model, h: ApplicationViewBuilder): Html =>
  h.block(
    HomeBinding.embedView({
      slotId: 'home',
      model: model.home,
      viewInputs: { songs: model.songs },
    }),
  )

const editorPageView = (model: Model, h: ApplicationViewBuilder): Html =>
  h.block(EditorBinding.embedView({ slotId: 'editor', model: model.editor }))

const playPageView = (model: Model, h: ApplicationViewBuilder): Html =>
  h.block(PlayBinding.embedView({ slotId: 'play', model: model.play }))

const missingSongView = (h: ApplicationViewBuilder): Html =>
  h.main(
    [h.Class('flex flex-col items-center gap-4 py-16 text-center')],
    [
      h.h1([h.Class(className.heading)], ['Song not found']),
      h.p(
        [h.Class('text-stone-600 dark:text-stone-400')],
        ['This chart is not in your library.'],
      ),
      h.a(
        [h.Href(homeRouter()), h.Class(className.secondaryButton)],
        ['Back to library'],
      ),
    ],
  )

const songPageView = (
  model: Model,
  songId: string,
  pageView: (model: Model, h: ApplicationViewBuilder) => Html,
  h: ApplicationViewBuilder,
): Html =>
  Option.match(Song.findById(model.songs, songId), {
    onNone: () => missingSongView(h),
    onSome: () => pageView(model, h),
  })

const documentTitle = (model: Model): string =>
  Match.value(model.route).pipe(
    Match.tagsExhaustive({
      Home: () => 'Coverchart',
      SongEdit: ({ songId }) =>
        Option.match(Song.findById(model.songs, songId), {
          onNone: () => 'Song not found · Coverchart',
          onSome: song => `${Song.displayTitle(song)} · Edit`,
        }),
      SongPlay: ({ songId }) =>
        Option.match(Song.findById(model.songs, songId), {
          onNone: () => 'Song not found · Coverchart',
          onSome: song => `${Song.displayTitle(song)} · Play`,
        }),
      NotFound: () => 'Not found · Coverchart',
    }),
  )

const routeBodyView = (model: Model, h: ApplicationViewBuilder): Html =>
  Match.value(model.route).pipe(
    Match.tagsExhaustive({
      Home: () => homePageView(model, h),
      SongEdit: ({ songId }) => songPageView(model, songId, editorPageView, h),
      SongPlay: ({ songId }) => songPageView(model, songId, playPageView, h),
      NotFound: ({ path }) => notFoundView(path, h),
    }),
  )

export const view = ApplicationComposition.makeView((model, h) => ({
  title: documentTitle(model),
  body: h.div(
    [
      h.Class(
        clsx(className.pageShell, {
          'is-dragging': DragAndDrop.isDragging(
            model.editor.sectionDragAndDrop,
          ),
        }),
      ),
    ],
    [
      h.div(
        [h.Class(className.pageInner)],
        [
          h.div(
            [h.Class('mb-6 flex justify-end')],
            [themeSelector(model.maybeThemePreference, h)],
          ),
          routeBodyView(model, h),
        ],
      ),
      toastView(model, h),
    ],
  ),
}))

import clsx from 'clsx'
import { Array, Option, pipe } from 'effect'
import { type Html, childAttributes } from 'foldkit/html'

import { Button, DragAndDrop, Input } from '@foldkit/ui'
import type { RenderInfo as DragAndDropRenderInfo } from '@foldkit/ui/dragAndDrop'
import type { AnchorConfig } from '@foldkit/ui/menu'

import {
  ARTIST_INPUT_ID,
  KEY_INPUT_ID,
  LYRICS_TEXTAREA_ID,
  PALETTE_INPUT_ID,
  SECTIONS_CONTAINER_ID,
  TITLE_INPUT_ID,
} from '../../constant'
import { Section, Song } from '../../domain'
import { homeRouter, songPlayRouter } from '../../route'
import * as className from '../../view/className'
import { labeledInput, labeledTextarea } from '../../view/field'
import {
  AddSectionMenuBinding,
  DeleteSectionDialogBinding,
  EditorComposition,
  type EditorViewBuilder,
  SectionDragAndDropBinding,
} from './composition'
import { isEditingSection, lineView, maybePlacingChord } from './lineView'
import { Message } from './message'
import { Announcement, Model } from './model'

const MENU_ANCHOR: typeof AnchorConfig.Type = {
  placement: 'bottom-start',
  gap: 4,
  padding: 8,
}

const metadataView = (
  song: typeof Song.Song.Type,
  h: EditorViewBuilder,
): Html =>
  h.div(
    [h.Class('grid gap-4 sm:grid-cols-3')],
    [
      labeledInput(
        {
          id: TITLE_INPUT_ID,
          labelText: 'Title',
          value: song.title,
          onInput: value => Message.UpdatedTitle({ value }),
          placeholder: 'Untitled',
        },
        h,
      ),
      labeledInput(
        {
          id: ARTIST_INPUT_ID,
          labelText: 'Artist',
          value: song.artist,
          onInput: value => Message.UpdatedArtist({ value }),
        },
        h,
      ),
      labeledInput(
        {
          id: KEY_INPUT_ID,
          labelText: 'Original key',
          value: Option.getOrElse(song.maybeOriginalKey, () => ''),
          onInput: value => Message.UpdatedOriginalKey({ value }),
          placeholder: 'G',
        },
        h,
      ),
    ],
  )

const paletteChipView = (name: string, h: EditorViewBuilder): Html =>
  h.keyed('div')(
    name,
    [
      h.Class(
        'inline-flex overflow-hidden rounded-md border border-stone-300 dark:border-stone-600',
      ),
    ],
    [
      h.span(
        [h.Class('px-3 py-2 font-semibold text-amber-800 dark:text-amber-300')],
        [name],
      ),
      Button.view(
        {
          onClick: Message.ClickedRemovePaletteChord({ name }),
          toView: attributes =>
            h.button(
              [
                ...attributes.button,
                h.Class(className.quietButton),
                h.AriaLabel(`Remove ${name} from this song`),
              ],
              ['×'],
            ),
        },
        h,
      ),
    ],
  )

const paletteView = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  h: EditorViewBuilder,
): Html =>
  h.div(
    [
      h.Class(
        'flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900',
      ),
    ],
    [
      h.div(
        [h.Class('flex min-w-0 flex-col gap-2')],
        [
          h.h2(
            [h.Class('text-sm font-medium text-stone-600 dark:text-stone-400')],
            ['Chords in this song'],
          ),
          Array.match(song.chords, {
            onEmpty: () =>
              h.p(
                [h.Class('text-sm text-stone-500 dark:text-stone-400')],
                ['Add the chords you need, then tap a word to place one.'],
              ),
            onNonEmpty: chords =>
              h.div(
                [h.Class('flex flex-wrap gap-2')],
                Array.map(chords, name => paletteChipView(name, h)),
              ),
          }),
        ],
      ),
      h.form(
        [
          h.Class('flex flex-wrap items-end gap-2'),
          h.OnSubmit(Message.SubmittedPaletteChord()),
        ],
        [
          Input.view(
            {
              id: PALETTE_INPUT_ID,
              value: model.paletteDraft,
              onInput: value => Message.UpdatedPaletteDraft({ value }),
              placeholder: 'G',
              toView: attributes =>
                h.div(
                  [h.Class('flex min-w-40 flex-1 flex-col gap-1')],
                  [
                    h.label(
                      [...attributes.label, h.Class(className.label)],
                      ['Add a chord'],
                    ),
                    h.input([...attributes.input, h.Class(className.input)]),
                  ],
                ),
            },
            h,
          ),
          Button.view(
            {
              type: 'submit',
              toView: attributes =>
                h.button(
                  [...attributes.button, h.Class(className.secondaryButton)],
                  ['Add'],
                ),
            },
            h,
          ),
        ],
      ),
    ],
  )

const lyricsEditorView = (draft: string, h: EditorViewBuilder): Html =>
  h.div(
    [h.Class('flex flex-col gap-3')],
    [
      labeledTextarea(
        {
          id: LYRICS_TEXTAREA_ID,
          labelText: 'Lyrics',
          value: draft,
          onInput: value => Message.UpdatedLyricsDraft({ value }),
          rows: 8,
          placeholder: 'Paste lyrics, one line per row',
        },
        h,
      ),
      h.div(
        [h.Class('flex gap-2')],
        [
          Button.view(
            {
              onClick: Message.ClickedSaveLyrics(),
              toView: attributes =>
                h.button(
                  [...attributes.button, h.Class(className.primaryButton)],
                  ['Save lyrics'],
                ),
            },
            h,
          ),
          Button.view(
            {
              onClick: Message.ClickedCancelLyrics(),
              toView: attributes =>
                h.button(
                  [...attributes.button, h.Class(className.secondaryButton)],
                  ['Cancel'],
                ),
            },
            h,
          ),
        ],
      ),
    ],
  )

const emptySectionBodyView = (h: EditorViewBuilder): Html =>
  h.p(
    [h.Class('text-sm text-stone-500 dark:text-stone-400')],
    ['No lyrics yet. Edit lyrics and paste while you listen.'],
  )

const chordLinesView = (
  section: typeof Section.Section.Type,
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  h: EditorViewBuilder,
): Html =>
  Array.match(section.lines, {
    onEmpty: () => emptySectionBodyView(h),
    onNonEmpty: lines =>
      h.div(
        [h.Class('flex flex-col gap-3')],
        Array.map(lines, line =>
          h.keyed('div')(
            line.id,
            [],
            [
              lineView(
                line,
                maybePlacingChord(model),
                song.chords,
                model.chordMenu,
                h,
              ),
            ],
          ),
        ),
      ),
  })

const sectionBodyView = (
  section: typeof Section.Section.Type,
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  h: EditorViewBuilder,
): Html =>
  isEditingSection(model, section.id)
    ? lyricsEditorView(Section.lyricsText(section), h)
    : chordLinesView(section, model, song, h)

const sectionActionsView = (
  section: typeof Section.Section.Type,
  canRemove: boolean,
  h: EditorViewBuilder,
): Html =>
  h.div(
    [h.Class('flex flex-wrap gap-2')],
    [
      Button.view(
        {
          onClick: Message.ClickedEditLyrics({ sectionId: section.id }),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.secondaryButton)],
              ['Edit lyrics'],
            ),
        },
        h,
      ),
      Button.view(
        {
          onClick: Message.ClickedDuplicateSection({ sectionId: section.id }),
          toView: attributes =>
            h.button(
              [...attributes.button, h.Class(className.quietButton)],
              ['Duplicate'],
            ),
        },
        h,
      ),
      canRemove
        ? Button.view(
            {
              onClick: Message.ClickedRemoveSection({ sectionId: section.id }),
              toView: attributes =>
                h.button(
                  [...attributes.button, h.Class(className.quietButton)],
                  ['Remove'],
                ),
            },
            h,
          )
        : h.empty,
    ],
  )

const dragHandleIcon = (h: EditorViewBuilder): Html =>
  h.svg(
    [
      h.AriaHidden(true),
      h.Class('h-4 w-2.5'),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.Fill('currentColor'),
      h.ViewBox('0 0 10 16'),
    ],
    [
      h.circle([h.Cx('2'), h.Cy('2'), h.R('1.25')]),
      h.circle([h.Cx('8'), h.Cy('2'), h.R('1.25')]),
      h.circle([h.Cx('2'), h.Cy('8'), h.R('1.25')]),
      h.circle([h.Cx('8'), h.Cy('8'), h.R('1.25')]),
      h.circle([h.Cx('2'), h.Cy('14'), h.R('1.25')]),
      h.circle([h.Cx('8'), h.Cy('14'), h.R('1.25')]),
    ],
  )

const sectionDragHandleView = (
  section: typeof Section.Section.Type,
  index: number,
  render: DragAndDropRenderInfo,
  h: EditorViewBuilder,
): Html =>
  h.div(
    [
      h.Class(className.dragHandle),
      h.AriaLabel(`Reorder ${Section.kindLabel(section.kind)}`),
      ...render.draggable({
        itemId: section.id,
        containerId: SECTIONS_CONTAINER_ID,
        index,
      }),
    ],
    [dragHandleIcon(h)],
  )

const sectionView = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  section: typeof Section.Section.Type,
  index: number,
  canRemove: boolean,
  render: DragAndDropRenderInfo,
  h: EditorViewBuilder,
): Html => {
  const isThisSectionDragged = Option.exists(
    DragAndDrop.maybeDraggedItemId(model.sectionDragAndDrop),
    id => id === section.id,
  )
  const isPointerDragged =
    model.sectionDragAndDrop.dragState._tag === 'Dragging' &&
    isThisSectionDragged
  const isKeyboardDragged =
    model.sectionDragAndDrop.dragState._tag === 'KeyboardDragging' &&
    isThisSectionDragged

  return h.keyed('li')(
    section.id,
    [
      h.Class(
        clsx('flex rounded-lg border bg-white shadow-sm dark:bg-stone-900', {
          'border-dashed border-stone-300 opacity-50 dark:border-stone-600':
            isPointerDragged,
          'border-amber-700 dark:border-amber-400': isKeyboardDragged,
          'border-stone-200 dark:border-stone-700':
            !isPointerDragged && !isKeyboardDragged,
        }),
      ),
    ],
    [
      sectionDragHandleView(section, index, render, h),
      h.div(
        [h.Class('min-w-0 flex-1 p-4')],
        [
          h.div(
            [h.Class('mb-3 flex items-center justify-between gap-2')],
            [
              h.h2(
                [
                  h.Class(
                    'text-lg font-semibold text-stone-800 dark:text-stone-100',
                  ),
                ],
                [Section.kindLabel(section.kind)],
              ),
              sectionActionsView(section, canRemove, h),
            ],
          ),
          sectionBodyView(section, model, song, h),
        ],
      ),
    ],
  )
}

const dropPlaceholder = (h: EditorViewBuilder): Html =>
  h.keyed('li')('drop-placeholder', [
    h.Class(
      'min-h-24 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950',
    ),
    h.AriaHidden(true),
  ])

const defaultSectionElements = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  canRemove: boolean,
  render: DragAndDropRenderInfo,
  h: EditorViewBuilder,
): ReadonlyArray<Html> =>
  Array.map(song.sections, (section, index) =>
    sectionView(model, song, section, index, canRemove, render, h),
  )

const previewSectionElements = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  canRemove: boolean,
  render: DragAndDropRenderInfo,
  h: EditorViewBuilder,
): ReadonlyArray<Html> => {
  if (!DragAndDrop.isDragging(model.sectionDragAndDrop)) {
    return defaultSectionElements(model, song, canRemove, render, h)
  }

  return Option.match(
    DragAndDrop.maybeDraggedItemId(model.sectionDragAndDrop),
    {
      onNone: () => defaultSectionElements(model, song, canRemove, render, h),
      onSome: draggedId => {
        const maybeTarget = DragAndDrop.maybeDropTarget(
          model.sectionDragAndDrop,
        )
        const visibleSections = Array.filter(
          song.sections,
          ({ id }) => id !== draggedId,
        )
        const sectionElements = Array.map(visibleSections, (section, index) =>
          sectionView(model, song, section, index, canRemove, render, h),
        )

        const isTargetList = Option.exists(
          maybeTarget,
          target => target.containerId === SECTIONS_CONTAINER_ID,
        )

        if (!isTargetList) {
          return sectionElements
        }

        const targetIndex = Option.match(maybeTarget, {
          onNone: () => visibleSections.length,
          onSome: target => Math.min(target.index, visibleSections.length),
        })

        const isPointerDrag =
          model.sectionDragAndDrop.dragState._tag === 'Dragging'
        const insertElement = isPointerDrag
          ? dropPlaceholder(h)
          : Option.match(Song.findSection(song, draggedId), {
              onNone: () => dropPlaceholder(h),
              onSome: section =>
                sectionView(
                  model,
                  song,
                  section,
                  targetIndex,
                  canRemove,
                  render,
                  h,
                ),
            })

        return pipe(
          sectionElements,
          Array.insertAt(targetIndex, insertElement),
          Option.getOrElse(() => Array.append(sectionElements, insertElement)),
        )
      },
    },
  )
}

const addSectionMenuView = (
  model: typeof Model.Type,
  h: EditorViewBuilder,
): Html =>
  h.div(
    [h.Class('relative')],
    [
      h.block(
        AddSectionMenuBinding.embedView({
          slotId: model.addSectionMenu.id,
          model: model.addSectionMenu,
          viewInputs: {
            anchor: MENU_ANCHOR,
            items: Section.SECTION_KINDS,
            itemToConfig: kind => ({
              className:
                'cursor-pointer px-3 py-2 text-sm text-stone-800 data-[active]:bg-stone-100 dark:text-stone-200 dark:data-[active]:bg-stone-800',
              content: h.span([], [Section.kindLabel(kind)]),
            }),
            buttonContent: h.span([], ['Add section']),
            buttonAttributes: childAttributes([
              h.Class(className.secondaryButton),
            ]),
            itemsAttributes: childAttributes([
              h.Class(
                'z-10 w-44 overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg outline-none dark:border-stone-700 dark:bg-stone-900',
              ),
            ]),
            attributes: childAttributes([h.Class('relative inline-block')]),
          },
        }),
      ),
    ],
  )

const deleteSectionDialogView = (
  model: typeof Model.Type,
  h: EditorViewBuilder,
): Html =>
  h.block(
    DeleteSectionDialogBinding.embedView({
      slotId: model.deleteSectionDialog.id,
      model: model.deleteSectionDialog,
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
                        ['Remove this section?'],
                      ),
                      h.p(
                        [
                          ...render.description,
                          h.Class(
                            'mt-2 text-sm text-stone-600 dark:text-stone-400',
                          ),
                        ],
                        ['Lyrics and chords in the section will be deleted.'],
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
                              onClick: Message.ClickedConfirmRemoveSection(),
                              toView: attributes =>
                                h.button(
                                  [
                                    ...attributes.button,
                                    ...render.initialFocus,
                                    h.Class(className.dangerButton),
                                  ],
                                  ['Remove section'],
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

const ghostSectionView = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  h: EditorViewBuilder,
): Html =>
  Option.match(
    Option.flatMap(
      DragAndDrop.ghostStyle(model.sectionDragAndDrop),
      ghostStyle =>
        Option.map(
          Option.flatMap(
            DragAndDrop.maybeDraggedItemId(model.sectionDragAndDrop),
            sectionId => Song.findSection(song, sectionId),
          ),
          section => ({ ghostStyle, section }),
        ),
    ),
    {
      onNone: () => h.empty,
      onSome: ({ ghostStyle, section }) =>
        h.div(
          [h.Style(ghostStyle), h.Class('w-80'), h.AriaHidden(true)],
          [
            h.div(
              [
                h.Class(
                  'rounded-lg border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900',
                ),
              ],
              [Section.kindLabel(section.kind)],
            ),
          ],
        ),
    },
  )

const sectionsView = (
  model: typeof Model.Type,
  song: typeof Song.Song.Type,
  canRemove: boolean,
  h: EditorViewBuilder,
): Html =>
  h.block(
    SectionDragAndDropBinding.embedView({
      slotId: model.sectionDragAndDrop.id,
      model: model.sectionDragAndDrop,
      viewInputs: {
        toView: render =>
          h.div(
            [],
            [
              h.ul(
                [
                  h.Class('flex flex-col gap-4'),
                  ...render.droppable(SECTIONS_CONTAINER_ID, 'Sections'),
                ],
                previewSectionElements(model, song, canRemove, render, h),
              ),
              ghostSectionView(model, song, h),
            ],
          ),
      },
    }),
  )

type ViewInputs = Readonly<{ song: typeof Song.Song.Type }>

const announcementText = (
  announcement: typeof Announcement.Type,
  song: typeof Song.Song.Type,
): string =>
  Announcement.match(announcement, {
    None: () => '',
    Cancelled: () => 'Section move cancelled.',
    Reordered: ({ sectionId, toIndex }) => {
      const kind = Option.match(Song.findSection(song, sectionId), {
        onNone: () => 'Section',
        onSome: section => Section.kindLabel(section.kind),
      })
      return `${kind} moved to position ${globalThis.String(toIndex + 1)}.`
    },
  })

export const view = EditorComposition.makeView.withInputs<ViewInputs>(
  (model, { song }, h) => {
    const canRemove = Array.match(Array.drop(song.sections, 1), {
      onEmpty: () => false,
      onNonEmpty: () => true,
    })

    return h.main(
      [
        h.Class(
          clsx('flex flex-col gap-8', {
            'is-dragging': DragAndDrop.isDragging(model.sectionDragAndDrop),
          }),
        ),
      ],
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
                        h.Href(songPlayRouter({ songId: song.id })),
                        h.Class(className.secondaryButton),
                      ],
                      ['Play'],
                    ),
                  ],
                ),
              ],
            ),
            metadataView(song, h),
            paletteView(model, song, h),
          ],
        ),
        h.div(
          [h.Class('flex items-center justify-between')],
          [
            h.h2(
              [
                h.Class(
                  'text-sm font-medium text-stone-600 dark:text-stone-400',
                ),
              ],
              ['Sections'],
            ),
            addSectionMenuView(model, h),
          ],
        ),
        sectionsView(model, song, canRemove, h),
        h.div(
          [h.Class('sr-only'), h.AriaLive('assertive')],
          [announcementText(model.announcement, song)],
        ),
        deleteSectionDialogView(model, h),
      ],
    )
  },
)

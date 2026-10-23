import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import {
  ApplyTheme,
  GenerateSongIds,
  NavigateInternal,
  SaveLibrary,
  SaveThemePreference,
} from './command'
import {
  EditorBinding,
  HomeBinding,
  PlayBinding,
  ToastBinding,
} from './composition'
import { MAX_CAPO, MAX_TRANSPOSE } from './constant'
import { Line, Song } from './domain'
import { Message } from './message'
import type { Model } from './model'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { CopyChart } from './page/play/command'
import { songEditRouter } from './route'
import { applicationModel } from './testFixture'
import { ToastBlock } from './toast'
import { update } from './update'

const emptyModel = applicationModel()

const emptyHomeView = HomeBlock.makeView((_model, h) => h.empty)

const homeMessage = (message: typeof HomeBlock.Message.Type) =>
  HomeBinding.embedView({
    slotId: 'home',
    model: emptyModel.home,
    view: emptyHomeView,
  }).toParentMessage(message)

describe('library', () => {
  test('creating a song saves it and opens the editor', () => {
    const songId = 'song-1'
    const sectionId = 'section-1'
    const created = Song.create(songId, sectionId)

    story(
      update,
      given(emptyModel),
      message(homeMessage(HomeBlock.Message.ClickedNewSong())),
      Command.expectExact(GenerateSongIds()),
      Command.resolve(
        GenerateSongIds,
        Message.CompletedGenerateSongIds({ songId, sectionId }),
      ),
      model(current => {
        expect(current.songs).toHaveLength(1)
        expect(current.songs[0]?.id).toBe(songId)
        expect(current.maybePendingEditSongId).toEqual(Option.some(songId))
      }),
      Command.expectExact(SaveLibrary({ songs: [created] })),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: ['song-1'] }),
      ),
      Command.expectExact(
        NavigateInternal({ url: songEditRouter({ songId }) }),
      ),
      Command.resolve(NavigateInternal, Message.CompletedNavigateInternal()),
    )
  })
})

describe('theme', () => {
  test('selecting dark mode applies and persists it', () => {
    story(
      update,
      given(emptyModel),
      message(Message.SelectedThemePreference({ preference: 'Dark' })),
      model(current => {
        expect(current.maybeThemePreference).toEqual(Option.some('Dark'))
      }),
      Command.expectExact(
        ApplyTheme({ theme: 'Dark' }),
        SaveThemePreference({ preference: 'Dark' }),
      ),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
      Command.resolve(
        SaveThemePreference,
        Message.CompletedSaveThemePreference(),
      ),
    )
  })

  test('system theme changes apply only while preference is System', () => {
    story(
      update,
      given(emptyModel),
      message(Message.ChangedSystemTheme({ theme: 'Dark' })),
      model(current => {
        expect(current.systemTheme).toBe('Dark')
      }),
      Command.expectExact(ApplyTheme({ theme: 'Dark' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
      message(Message.SelectedThemePreference({ preference: 'Light' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
      Command.resolve(
        SaveThemePreference,
        Message.CompletedSaveThemePreference(),
      ),
      message(Message.ChangedSystemTheme({ theme: 'Dark' })),
      model(current => {
        expect(current.systemTheme).toBe('Dark')
      }),
      Command.expectExact(ApplyTheme({ theme: 'Light' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
    )
  })
})

const emptyEditorView = EditorBlock.makeView((_model, h) => h.empty)
const emptyPlayView = PlayBlock.makeView((_model, h) => h.empty)

const editorMessage = (
  model: typeof Model.Type,
  message: typeof EditorBlock.Message.Type,
) => {
  const instance = Option.getOrThrow(model.maybeEditorInstance)
  return EditorBinding.embedView({
    key: instance.songId,
    slotId: instance.songId,
    model: instance.model,
    view: emptyEditorView,
  }).toParentMessage(message)
}

const playMessage = (
  model: typeof Model.Type,
  message: typeof PlayBlock.Message.Type,
) => {
  const instance = Option.getOrThrow(model.maybePlayInstance)
  return PlayBinding.embedView({
    key: instance.songId,
    slotId: instance.songId,
    model: instance.model,
    view: emptyPlayView,
  }).toParentMessage(message)
}

describe('song ownership', () => {
  test('successive child edits preserve the latest canonical fields', () => {
    const song = Song.create('song-1', 'section-1')
    const initial = applicationModel([song], '/songs/song-1')
    const titled = modifyFields(song, { title: () => 'Blackbird' })
    const edited = modifyFields(titled, { artist: () => 'The Beatles' })

    story(
      update,
      given(initial),
      message(
        editorMessage(
          initial,
          EditorBlock.Message.UpdatedTitle({ value: 'Blackbird' }),
        ),
      ),
      Command.expectExact(SaveLibrary({ songs: [titled] })),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      message(
        editorMessage(
          initial,
          EditorBlock.Message.UpdatedArtist({ value: 'The Beatles' }),
        ),
      ),
      Command.expectExact(SaveLibrary({ songs: [edited] })),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      model(current => {
        expect(Song.findById(current.songs, song.id)).toEqual(
          Option.some(edited),
        )
      }),
    )
  })

  test('play controls apply to the canonical song without changing stored chord names', () => {
    const song = Song.updateSection(
      Song.create('song-1', 'section-1'),
      'section-1',
      section =>
        modifyFields(section, {
          lines: () => [
            Line.upsertMark(Line.empty('line-1', 'Hello world'), {
              id: 'mark-1',
              at: 0,
              name: 'G',
            }),
          ],
        }),
    )
    const initial = applicationModel([song], '/songs/song-1/play')
    const transposed = modifyFields(song, { transpose: () => 1 })

    story(
      update,
      given(initial),
      message(playMessage(initial, PlayBlock.Message.ClickedTransposeUp())),
      Command.expectExact(SaveLibrary({ songs: [transposed] })),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      model(current => {
        const canonical = Option.getOrThrow(
          Song.findById(current.songs, song.id),
        )
        expect(canonical).toEqual(transposed)
        expect(Song.toChartText(canonical)).toContain('G#')
      }),
    )
  })

  test('copy uses current parent data and handles the lifted completion', () => {
    const song = modifyFields(Song.create('song-1', 'section-1'), {
      title: () => 'A fresh title',
    })
    const initial = applicationModel([song], '/songs/song-1/play')

    story(
      update,
      given(initial),
      message(playMessage(initial, PlayBlock.Message.ClickedCopyChart())),
      Command.expectExact(CopyChart({ text: Song.toChartText(song) })),
      Command.resolve(CopyChart, PlayBlock.Message.SucceededCopyChart()),
      ToastBlock.test.drainEntry({
        binding: ToastBinding,
        entryId: 'app-toast-entry-0',
      }),
    )
  })

  test('an older save acknowledgement cannot complete new-song navigation', () => {
    const initial = modifyFields(
      applicationModel([Song.create('new-song', 'new-section')]),
      {
        maybePendingEditSongId: () => Option.some('new-song'),
      },
    )

    story(
      update,
      given(initial),
      message(Message.SucceededSaveLibrary({ songIds: ['old-song'] })),
      Command.expectNone(),
      model(current =>
        expect(current.maybePendingEditSongId).toEqual(Option.some('new-song')),
      ),
      message(Message.SucceededSaveLibrary({ songIds: ['new-song'] })),
      Command.expectExact(
        NavigateInternal({ url: songEditRouter({ songId: 'new-song' }) }),
      ),
      Command.resolve(NavigateInternal, Message.CompletedNavigateInternal()),
      model(current =>
        expect(current.maybePendingEditSongId).toEqual(Option.none()),
      ),
    )
  })

  test('an unrelated save failure leaves new-song navigation pending', () => {
    const initial = modifyFields(
      applicationModel([Song.create('new-song', 'new-section')]),
      {
        maybePendingEditSongId: () => Option.some('new-song'),
      },
    )

    story(
      update,
      given(initial),
      message(
        Message.FailedSaveLibrary({
          error: 'Old save failed',
          songIds: ['old-song'],
        }),
      ),
      ToastBlock.test.drainEntry({
        binding: ToastBinding,
        entryId: 'app-toast-entry-0',
      }),
      model(current =>
        expect(current.maybePendingEditSongId).toEqual(Option.some('new-song')),
      ),
    )
  })
})

describe('canonical display preference limits', () => {
  test.each([
    { transpose: MAX_TRANSPOSE, capo: MAX_CAPO, direction: 'Up' },
    { transpose: -MAX_TRANSPOSE, capo: 0, direction: 'Down' },
  ])(
    'keeps $direction controls within their bounds',
    ({ transpose, capo, direction }) => {
      const song = modifyFields(Song.create('song-1', 'section-1'), {
        transpose: () => transpose,
        capo: () => capo,
      })
      const initial = applicationModel([song], '/songs/song-1/play')
      const transposeMessage =
        direction === 'Up'
          ? PlayBlock.Message.ClickedTransposeUp()
          : PlayBlock.Message.ClickedTransposeDown()
      const capoMessage =
        direction === 'Up'
          ? PlayBlock.Message.ClickedCapoUp()
          : PlayBlock.Message.ClickedCapoDown()

      story(
        update,
        given(initial),
        message(playMessage(initial, transposeMessage)),
        Command.expectExact(SaveLibrary({ songs: [song] })),
        Command.resolve(
          SaveLibrary,
          Message.SucceededSaveLibrary({ songIds: [song.id] }),
        ),
        message(playMessage(initial, capoMessage)),
        Command.expectExact(SaveLibrary({ songs: [song] })),
        Command.resolve(
          SaveLibrary,
          Message.SucceededSaveLibrary({ songIds: [song.id] }),
        ),
        model(current => expect(current.songs).toEqual([song])),
      )
    },
  )
})

import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  ApplyTheme,
  GenerateSongIds,
  NavigateInternal,
  SaveLibrary,
  SaveThemePreference,
} from './command'
import { HomeBinding } from './composition'
import { Song } from './domain'
import { Message } from './message'
import type { Model } from './model'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ApplicationRoute, songEditRouter } from './route'
import { ToastBlock } from './toast'
import { update } from './update'

const emptyModel: Model = {
  route: ApplicationRoute.Home(),
  songs: [],
  home: HomeBlock.init().model,
  editor: EditorBlock.init(Song.create('placeholder-song', 'section-1')).model,
  play: PlayBlock.init(Song.create('placeholder-song', 'section-1')).model,
  toast: ToastBlock.init({ id: 'app-toast' }).model,
  maybePendingEditSongId: Option.none(),
  maybeThemePreference: Option.some('System'),
  systemTheme: 'Light',
  resolvedTheme: 'Light',
}

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
        expect(current.editor.song.id).toBe(songId)
      }),
      Command.expectExact(SaveLibrary({ songs: [created] })),
      Command.resolve(SaveLibrary, Message.SucceededSaveLibrary()),
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
        expect(current.resolvedTheme).toBe('Dark')
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
        expect(current.resolvedTheme).toBe('Dark')
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
        expect(current.resolvedTheme).toBe('Light')
      }),
      Command.expectExact(ApplyTheme({ theme: 'Light' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
    )
  })
})

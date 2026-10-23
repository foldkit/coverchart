import { Option } from 'effect'
import {
  Command,
  click,
  expect,
  given,
  role,
  scene,
  selector,
  text,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import {
  ApplyTheme,
  GenerateSongIds,
  NavigateInternal,
  SaveLibrary,
  SaveThemePreference,
} from './command'
import { SECTIONS_CONTAINER_ID } from './constant'
import { Song } from './domain'
import { Message } from './message'
import type { Model } from './model'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ApplicationRoute } from './route'
import { ToastBlock } from './toast'
import { update } from './update'
import { view } from './view'

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

describe('library view', () => {
  test('empty library shows the heading and new song button', () => {
    scene(
      { update, view },
      given(emptyModel),
      expect(role('heading', { name: 'Coverchart' })).toExist(),
      expect(role('button', { name: 'New song' })).toExist(),
      expect(
        text('No songs yet. Start a chart and paste lyrics while you listen.'),
      ).toExist(),
      click(role('button', { name: 'New song' })),
      Command.resolve(
        GenerateSongIds,
        Message.CompletedGenerateSongIds({
          songId: 'song-1',
          sectionId: 'section-1',
        }),
      ),
      Command.resolve(SaveLibrary, Message.SucceededSaveLibrary()),
      Command.resolve(NavigateInternal, Message.CompletedNavigateInternal()),
    )
  })

  test('theme selector switches to dark mode', () => {
    scene(
      { update, view },
      given(emptyModel),
      expect(role('group', { name: 'Theme preference' })).toExist(),
      expect(role('button', { name: 'System mode' })).toHaveAttr(
        'aria-pressed',
        'true',
      ),
      click(role('button', { name: 'Dark mode' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
      Command.resolve(
        SaveThemePreference,
        Message.CompletedSaveThemePreference(),
      ),
      expect(role('button', { name: 'Dark mode' })).toHaveAttr(
        'aria-pressed',
        'true',
      ),
      expect(role('button', { name: 'System mode' })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
    )
  })

  test('the shell marks itself as dragging while a section is moved', () => {
    const song = Song.create('song-1', 'section-1')
    const editorInit = EditorBlock.init(song)
    const dragging: Model = modifyFields(emptyModel, {
      route: () => ApplicationRoute.SongEdit({ songId: song.id }),
      songs: () => [song],
      editor: () =>
        modifyFields(editorInit.model, {
          sectionDragAndDrop: dnd =>
            modifyFields(dnd, {
              dragState: () => ({
                _tag: 'Dragging',
                itemId: 'section-1',
                sourceContainerId: SECTIONS_CONTAINER_ID,
                sourceIndex: 0,
                origin: { screenX: 0, screenY: 0 },
                current: { clientX: 10, clientY: 10 },
                maybeDropTarget: Option.none(),
              }),
            }),
        }),
    })

    scene(
      { update, view },
      given(dragging),
      expect(selector('.is-dragging')).toExist(),
      expect(role('link', { name: 'Library' })).toExist(),
    )
  })
})

import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  given,
  label,
  role,
  scene,
  selector,
  text,
  type,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Menu } from '@foldkit/ui'

import {
  ApplyTheme,
  GenerateSongIds,
  NavigateInternal,
  SaveLibrary,
  SaveThemePreference,
} from './command'
import { SECTIONS_CONTAINER_ID } from './constant'
import { Line, Song } from './domain'
import { Message } from './message'
import { EditorBlock } from './page'
import { GenerateEditorIds } from './page/editor/command'
import { ChordMenuBlock } from './page/editor/menu'
import { IdRequest } from './page/editor/message'
import { applicationModel } from './testFixture'
import { update } from './update'
import { view } from './view'

const emptyModel = applicationModel()

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
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: ['song-1'] }),
      ),
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

  test('the editor marks itself as dragging while a section is moved', () => {
    const song = Song.create('song-1', 'section-1')
    const dragging = modifyFields(applicationModel([song], '/songs/song-1'), {
      maybeEditorInstance: Option.map(instance =>
        modifyFields(instance, {
          model: editor =>
            modifyFields(editor, {
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
        }),
      ),
    })

    scene(
      { update, view },
      given(dragging),
      expect(selector('.is-dragging')).toExist(),
      expect(role('link', { name: 'Library' })).toExist(),
    )
  })
})

describe('canonical song rendering', () => {
  test('editing a title updates the input and heading from parent data', () => {
    const song = Song.create('song-1', 'section-1')

    scene(
      { update, view },
      given(applicationModel([song], '/songs/song-1')),
      type(label('Title'), 'Blackbird'),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      expect(role('heading', { name: 'Blackbird' })).toExist(),
      expect(label('Title')).toHaveValue('Blackbird'),
    )
  })

  test('lyrics autosave and cancel restores only the section backup', () => {
    const song = Song.updateSection(
      Song.create('song-1', 'section-1'),
      'section-1',
      section =>
        modifyFields(section, {
          lines: () => [Line.empty('line-1', 'Original words')],
        }),
    )

    scene(
      { update, view },
      given(applicationModel([song], '/songs/song-1')),
      click(role('button', { name: 'Edit lyrics' })),
      type(label('Lyrics'), 'New words'),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      expect(label('Lyrics')).toHaveValue('New words'),
      type(label('Title'), 'Keep this title'),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      click(role('button', { name: 'Cancel' })),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      expect(role('button', { name: 'Place chord on Original' })).toExist(),
      expect(role('button', { name: 'Place chord on New' })).toBeAbsent(),
      expect(role('heading', { name: 'Keep this title' })).toExist(),
    )
  })

  test('a nested Menu selection edits the parent song and releases its Mounts', () => {
    const song = modifyFields(
      Song.updateSection(
        Song.create('song-1', 'section-1'),
        'section-1',
        section =>
          modifyFields(section, {
            lines: () => [Line.empty('line-1', 'Hello world')],
          }),
      ),
      { chords: () => ['G'] },
    )

    scene(
      { update, view },
      given(applicationModel([song], '/songs/song-1')),
      click(role('button', { name: 'Place chord on Hello' })),
      Command.resolve(
        Menu.test.FocusMenuItems,
        ChordMenuBlock.Message.CompletedFocusMenuItems(),
      ),
      Mount.resolve(
        Menu.test.AnchorMenu,
        ChordMenuBlock.Message.CompletedAnchorMenu(),
      ),
      Mount.resolve(
        Menu.test.PortalMenuBackdrop,
        ChordMenuBlock.Message.CompletedPortalMenuBackdrop(),
      ),
      click(role('menuitem', { name: 'G' })),
      Command.resolve(
        Menu.test.FocusMenuButton,
        ChordMenuBlock.Message.CompletedFocusMenuButton(),
      ),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      Command.resolve(
        GenerateEditorIds,
        EditorBlock.Message.CompletedGenerateEditorIds({
          ids: ['mark-1'],
          request: IdRequest.NewMark({
            lineId: 'line-1',
            expectedLyric: 'Hello world',
            at: 0,
            name: 'G',
          }),
        }),
      ),
      Command.resolve(
        SaveLibrary,
        Message.SucceededSaveLibrary({ songIds: [song.id] }),
      ),
      Mount.expectEnded(Menu.test.AnchorMenu),
      Mount.expectEnded(Menu.test.PortalMenuBackdrop),
      expect(role('button', { name: 'Edit chord G on Hello' })).toExist(),
    )
  })
})

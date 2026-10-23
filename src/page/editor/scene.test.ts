import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  expectOutMessage,
  given,
  pointerDown,
  role,
  scene,
  withViewInputs,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Menu } from '@foldkit/ui'

import { Line, Song } from '../../domain'
import { EditorBlock } from './block'
import { GenerateEditorIds } from './command'
import { init } from './init'
import { ChordMenuBlock } from './menu'
import { IdRequest, Message, OutMessage } from './message'
import { update as contextualUpdate } from './update'
import { view } from './view'

const song = Song.updateSection(
  Song.create('song-1', 'section-1'),
  'section-1',
  section =>
    modifyFields(section, {
      lines: () => [Line.empty('line-1', 'Hello world')],
    }),
)

const editorInit = init()
const update = (
  model: typeof EditorBlock.Model.Type,
  message: typeof EditorBlock.Message.Type,
) => contextualUpdate(model, message, Option.some(song))
const sceneView = withViewInputs(view, { song })

describe('editor view', () => {
  test('clicking a lyric word then a song chord places it', () => {
    scene(
      {
        update,
        view: sceneView({ song: modifyFields(song, { chords: () => ['G'] }) }),
      },
      given(editorInit.model),
      expect(role('heading', { name: 'Untitled' })).toExist(),
      expect(role('button', { name: 'Place chord on Hello' })).toExist(),
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
        GenerateEditorIds,
        Message.CompletedGenerateEditorIds({
          ids: ['mark-1'],
          request: IdRequest.NewMark({
            expectedLyric: 'Hello world',
            lineId: 'line-1',
            at: 0,
            name: 'G',
          }),
        }),
      ),
      Mount.expectEnded(Menu.test.AnchorMenu),
      Mount.expectEnded(Menu.test.PortalMenuBackdrop),
      expectOutMessage(
        OutMessage.PlacedChord({
          lineId: 'line-1',
          mark: { id: 'mark-1', at: 0, name: 'G' },
        }),
      ),
    )
  })

  test('section reorder starts from the drag handle, not the card body', () => {
    scene(
      { update, view: sceneView() },
      given(editorInit.model),
      expect(role('option', { name: 'Reorder Verse' })).toExist(),
      expect(role('option', { name: 'Reorder Verse' })).toHaveAttr(
        'aria-roledescription',
        'draggable',
      ),
      pointerDown(role('option', { name: 'Reorder Verse' })),
      click(role('button', { name: 'Edit lyrics' })),
      expect(role('textbox', { name: 'Lyrics' })).toExist(),
    )
  })
})

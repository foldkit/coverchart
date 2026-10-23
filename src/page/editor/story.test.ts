import { Option } from 'effect'
import {
  Command,
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Menu } from '@foldkit/ui'

import { Line, Song } from '../../domain'
import { EditorBlock } from './block'
import { GenerateEditorIds } from './command'
import { ChordMenuBinding } from './composition'
import { init } from './init'
import { ChordMenuBlock } from './menu'
import { IdRequest, Message, OutMessage } from './message'
import { update as contextualUpdate } from './update'

const baseSong = Song.create('song-1', 'section-1')
const song = Song.updateSection(baseSong, 'section-1', section =>
  modifyFields(section, {
    lines: () => [Line.empty('line-1', 'Hello world')],
  }),
)

const editorInit = init()
const update = (
  model: typeof EditorBlock.Model.Type,
  message: typeof EditorBlock.Message.Type,
) => contextualUpdate(model, message, Option.some(song))
const emptyChordMenuView = ChordMenuBlock.makeView((_model, h) => h.empty)

const chordMenuMessage = (message: typeof ChordMenuBlock.Message.Type) =>
  ChordMenuBinding.embedView({
    slotId: 'chord-menu',
    model: editorInit.model.chordMenu,
    view: emptyChordMenuView,
  }).toParentMessage(message)

describe('editor', () => {
  test('updating the title reports the new value', () => {
    story(
      update,
      given(editorInit.model),
      message(Message.UpdatedTitle({ value: 'Blackbird' })),
      expectOutMessage(OutMessage.UpdatedTitle({ value: 'Blackbird' })),
      model(current => {
        expect(current.mode._tag).toBe('Viewing')
      }),
    )
  })

  test('typing lyrics reports edits without storing a second draft', () => {
    const draft = 'Hello world\nFrom a song'

    story(
      update,
      given(editorInit.model),
      message(Message.ClickedEditLyrics({ sectionId: 'section-1' })),
      expectNoOutMessage(),
      message(Message.UpdatedLyricsDraft({ value: draft })),
      expectOutMessage(
        OutMessage.UpdatedLyrics({ sectionId: 'section-1', draft }),
      ),
      model(current => {
        expect(current.mode).toMatchObject({
          _tag: 'EditingLyrics',
          sectionId: 'section-1',
        })
      }),
    )
  })

  test('clicking a word starts placing a chord', () => {
    story(
      update,
      given(editorInit.model),
      message(Message.ClickedWord({ lineId: 'line-1', at: 0 })),
      expectNoOutMessage(),
      Command.resolve(
        Menu.test.FocusMenuItems,
        ChordMenuBlock.Message.CompletedFocusMenuItems(),
      ),
      model(current => {
        expect(current.mode._tag).toBe('PlacingChord')
        expect(current.chordMenu.isOpen).toBe(true)
      }),
    )
  })

  test('blurring the chord menu stops placing a chord', () => {
    story(
      update,
      given(editorInit.model),
      message(Message.ClickedWord({ lineId: 'line-1', at: 0 })),
      Command.resolve(
        Menu.test.FocusMenuItems,
        ChordMenuBlock.Message.CompletedFocusMenuItems(),
      ),
      message(chordMenuMessage(ChordMenuBlock.Message.BlurredItems())),
      model(current => {
        expect(current.mode._tag).toBe('Viewing')
        expect(current.chordMenu.isOpen).toBe(false)
      }),
    )
  })

  test('adding a song chord and tapping it places the mark', () => {
    story(
      update,
      given(editorInit.model),
      message(Message.UpdatedPaletteDraft({ value: 'G' })),
      message(Message.SubmittedPaletteChord()),
      expectOutMessage(OutMessage.AddedChord({ name: 'G' })),
      message(Message.ClickedWord({ lineId: 'line-1', at: 0 })),
      Command.resolve(
        Menu.test.FocusMenuItems,
        ChordMenuBlock.Message.CompletedFocusMenuItems(),
      ),
      message(
        chordMenuMessage(
          ChordMenuBlock.Message.SelectedItem({ index: 0, item: 'G' }),
        ),
      ),
      Command.resolve(
        Menu.test.FocusMenuButton,
        ChordMenuBlock.Message.CompletedFocusMenuButton(),
      ),
      Command.expectExact(
        GenerateEditorIds({
          count: 1,
          request: IdRequest.NewMark({
            expectedLyric: 'Hello world',
            lineId: 'line-1',
            at: 0,
            name: 'G',
          }),
        }),
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
    )
  })
})

describe('in-flight chord placement', () => {
  test('ignores generated IDs when the target lyric has changed', () => {
    const changedSong = Song.updateLine(song, 'line-1', line =>
      modifyFields(line, { lyric: () => 'Different words' }),
    )
    const updateWithChangedSong = (
      model: typeof EditorBlock.Model.Type,
      message: typeof EditorBlock.Message.Type,
    ) => contextualUpdate(model, message, Option.some(changedSong))

    story(
      updateWithChangedSong,
      given(editorInit.model),
      message(
        Message.CompletedGenerateEditorIds({
          ids: ['old-mark'],
          request: IdRequest.NewMark({
            lineId: 'line-1',
            expectedLyric: 'Hello world',
            at: 0,
            name: 'G',
          }),
        }),
      ),
      expectNoOutMessage(),
    )
  })
})

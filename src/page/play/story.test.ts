import {
  Command,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Line, Song } from '../../domain'
import { CopyChart } from './command'
import { init } from './init'
import { Message, OutMessage } from './message'
import { update } from './update'

const base = Song.updateSection(
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

const playInit = init(base)

describe('play view preferences', () => {
  test('transpose up changes display without rewriting stored chord names', () => {
    story(
      update,
      given(playInit.model),
      message(Message.ClickedTransposeUp()),
      model(current => {
        expect(current.song.transpose).toBe(1)
        expect(current.song.sections[0]?.lines[0]?.marks[0]?.name).toBe('G')
        expect(Song.toChartText(current.song)).toContain('G#')
      }),
      expectOutMessage(
        OutMessage.UpdatedSong({
          song: modifyFields(base, { transpose: () => 1 }),
        }),
      ),
    )
  })

  test('capo up displays shapes a whole step down', () => {
    story(
      update,
      given(playInit.model),
      message(Message.ClickedCapoUp()),
      model(current => {
        expect(current.song.capo).toBe(1)
        expect(Song.toChartText(current.song)).toContain('F#')
      }),
      expectOutMessage(
        OutMessage.UpdatedSong({ song: modifyFields(base, { capo: () => 1 }) }),
      ),
    )
  })

  test('copying the chart succeeds', () => {
    story(
      update,
      given(playInit.model),
      message(Message.ClickedCopyChart()),
      Command.expectExact(CopyChart({ text: Song.toChartText(base) })),
      Command.resolve(CopyChart, Message.SucceededCopyChart()),
    )
  })

  test('copying the chart can fail', () => {
    story(
      update,
      given(playInit.model),
      message(Message.ClickedCopyChart()),
      Command.resolve(
        CopyChart,
        Message.FailedCopyChart({ error: 'Could not copy the chart.' }),
      ),
    )
  })
})

import { Option } from 'effect'

import { Song } from '../../domain'
import { CopyChart } from './command'
import { PlayComposition } from './composition'
import { Message, OutMessage } from './message'

export const update = PlayComposition.makeUpdate(
  (model, message, maybeSong: Option.Option<typeof Song.Song.Type>) =>
    Message.match(message, {
      ClickedTransposeDown: () => ({
        model,
        outMessage: OutMessage.AdjustedTranspose({ by: -1 }),
      }),
      ClickedTransposeUp: () => ({
        model,
        outMessage: OutMessage.AdjustedTranspose({ by: 1 }),
      }),
      ClickedCapoDown: () => ({
        model,
        outMessage: OutMessage.AdjustedCapo({ by: -1 }),
      }),
      ClickedCapoUp: () => ({
        model,
        outMessage: OutMessage.AdjustedCapo({ by: 1 }),
      }),
      ClickedCopyChart: () =>
        Option.match(maybeSong, {
          onNone: () => ({ model }),
          onSome: song => ({
            model,
            commands: [CopyChart({ text: Song.toChartText(song) })],
          }),
        }),
      SucceededCopyChart: () => ({
        model,
        outMessage: OutMessage.CopiedChart(),
      }),
      FailedCopyChart: ({ error }) => ({
        model,
        outMessage: OutMessage.FailedCopy({ error }),
      }),
    }),
)

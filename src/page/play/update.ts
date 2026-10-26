import { Option } from 'effect'

import { Song } from '../../domain'
import { CopyChart } from './command'
import { PlayComposition } from './composition'
import { PlayDefinition } from './definition'
import { Message, OutMessage } from './message'

const handleFailedCopyChart = PlayDefinition.makeOutMessageStep.fromMessage(
  ({ error }: typeof Message.FailedCopyChart.Type) =>
    OutMessage.FailedCopy({ error }),
)

export const update = PlayComposition.makeUpdate.withContext(
  (maybeSong: Option.Option<typeof Song.Song.Type>) => ({
    ClickedTransposeDown: model =>
      PlayDefinition.makeOutMessageStep(() =>
        OutMessage.AdjustedTranspose({ by: -1 }),
      )(model),
    ClickedTransposeUp: model =>
      PlayDefinition.makeOutMessageStep(() =>
        OutMessage.AdjustedTranspose({ by: 1 }),
      )(model),
    ClickedCapoDown: model =>
      PlayDefinition.makeOutMessageStep(() =>
        OutMessage.AdjustedCapo({ by: -1 }),
      )(model),
    ClickedCapoUp: model =>
      PlayDefinition.makeOutMessageStep(() =>
        OutMessage.AdjustedCapo({ by: 1 }),
      )(model),
    ClickedCopyChart: model =>
      Option.match(maybeSong, {
        onNone: () => PlayDefinition.makeNoopStep()(model),
        onSome: song =>
          PlayDefinition.makeCommandsStep(() => [
            CopyChart({ text: Song.toChartText(song) }),
          ])(model),
      }),
    SucceededCopyChart: model =>
      PlayDefinition.makeOutMessageStep(() => OutMessage.CopiedChart())(model),
    FailedCopyChart: (model, message) => handleFailedCopyChart(model, message),
  }),
)

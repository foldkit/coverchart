import { Number } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { MAX_CAPO, MAX_TRANSPOSE } from '../../constant'
import { Song } from '../../domain'
import { CopyChart } from './command'
import { PlayComposition } from './composition'
import { Message, OutMessage } from './message'
import { Model } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

const clamp = (value: number, min: number, max: number): number =>
  Number.min(max)(Number.max(min)(value))

const emitSong = (model: Model, song: Song.Song): UpdateReturn => ({
  model: modifyFields(model, { song: () => song }),
  outMessage: OutMessage.UpdatedSong({ song }),
})

export const update = PlayComposition.makeUpdate((model, message) =>
  Message.match(message, {
    InformedOfSongChange: ({ song }) => ({
      model:
        model.song.id === song.id
          ? modifyFields(model, { song: () => song })
          : model,
    }),
    ClickedTransposeDown: () =>
      emitSong(
        model,
        modifyFields(model.song, {
          transpose: transpose =>
            clamp(transpose - 1, -MAX_TRANSPOSE, MAX_TRANSPOSE),
        }),
      ),

    ClickedTransposeUp: () =>
      emitSong(
        model,
        modifyFields(model.song, {
          transpose: transpose =>
            clamp(transpose + 1, -MAX_TRANSPOSE, MAX_TRANSPOSE),
        }),
      ),

    ClickedCapoDown: () =>
      emitSong(
        model,
        modifyFields(model.song, {
          capo: capo => clamp(capo - 1, 0, MAX_CAPO),
        }),
      ),

    ClickedCapoUp: () =>
      emitSong(
        model,
        modifyFields(model.song, {
          capo: capo => clamp(capo + 1, 0, MAX_CAPO),
        }),
      ),

    ClickedCopyChart: () => ({
      model,
      commands: [CopyChart({ text: Song.toChartText(model.song) })],
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

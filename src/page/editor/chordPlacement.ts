import { Option, String } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { GenerateEditorIds } from './command'
import { EditorDefinition } from './definition'
import { IdRequest, OutMessage } from './message'
import { EditorMode } from './model'

export const placeChord = (name: string) =>
  EditorDefinition.makeStep(model =>
    EditorMode.match(model.mode, {
      Viewing: () => ({ model }),
      EditingLyrics: () => ({ model }),
      PlacingChord: placing => {
        const nextModel = modifyFields(model, {
          mode: () => EditorMode.Viewing(),
        })

        if (String.isEmpty(name)) {
          return Option.match(placing.maybeMarkId, {
            onNone: () => ({ model: nextModel }),
            onSome: markId => ({
              model: nextModel,
              outMessage: OutMessage.ClearedChord({
                lineId: placing.lineId,
                markId,
              }),
            }),
          })
        }

        return Option.match(placing.maybeMarkId, {
          onSome: markId => ({
            model: nextModel,
            outMessage: OutMessage.RenamedChord({
              lineId: placing.lineId,
              markId,
              name,
            }),
          }),
          onNone: () => ({
            model,
            commands: [
              GenerateEditorIds({
                count: 1,
                request: IdRequest.NewMark({
                  expectedLyric: placing.expectedLyric,
                  lineId: placing.lineId,
                  at: placing.at,
                  name,
                }),
              }),
            ],
            outMessage: OutMessage.AddedChord({ name }),
          }),
        })
      },
    }),
  )

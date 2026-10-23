import { Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { DeleteDialogBinding, HomeComposition } from './composition'
import { Message, OutMessage } from './message'

export const update = HomeComposition.makeUpdate((model, message) =>
  Message.match(message, {
    UpdatedSearchQuery: ({ value }) => ({
      model: modifyFields(model, { searchQuery: () => value }),
    }),

    ClickedNewSong: () => ({
      model,
      outMessage: OutMessage.RequestedNewSong(),
    }),

    ClickedDeleteSong: ({ songId }) =>
      Update.combineSteps(
        modifyFields(model, {
          maybePendingDeleteSongId: () => Option.some(songId),
        }),
        [DeleteDialogBinding.requestOpen()],
      ),

    ClickedConfirmDelete: () =>
      Option.match(model.maybePendingDeleteSongId, {
        onNone: () => DeleteDialogBinding.requestClose()(model),
        onSome: songId =>
          Update.withOutMessage(
            DeleteDialogBinding.requestClose()(
              modifyFields(model, {
                maybePendingDeleteSongId: () => Option.none(),
              }),
            ),
            OutMessage.ConfirmedDeleteSong({ songId }),
          ),
      }),
  }),
)

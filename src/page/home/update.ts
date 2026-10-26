import { Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { DeleteDialogBinding, HomeComposition } from './composition'
import { HomeDefinition } from './definition'
import { OutMessage } from './message'

export const update = HomeComposition.makeUpdate({
  UpdatedSearchQuery: HomeDefinition.makeFieldsStep.fromMessage(
    ({ value }) => ({
      searchQuery: () => value,
    }),
  ),

  ClickedNewSong: HomeDefinition.makeOutMessageStep(() =>
    OutMessage.RequestedNewSong(),
  ),

  ClickedDeleteSong: (model, { songId }) =>
    DeleteDialogBinding.requestOpen()(
      modifyFields(model, {
        maybePendingDeleteSongId: () => Option.some(songId),
      }),
    ),

  ClickedConfirmDelete: model =>
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
})

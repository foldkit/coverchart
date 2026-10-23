import { Option } from 'effect'
import type { Block } from 'foldkit'

import { DialogBlock } from '@foldkit/ui'

import { HomeDefinition } from './definition'

const foldDeleteDialogOutMessage = HomeDefinition.makeOutMessageFold(
  DialogBlock,
  {
    Opened: HomeDefinition.makeNoopStep,
    Closed: () =>
      HomeDefinition.makeFieldsStep(() => ({
        maybePendingDeleteSongId: () => Option.none(),
      })),
    CompletedClose: HomeDefinition.makeNoopStep,
  },
)

export const DeleteDialogBinding = HomeDefinition.makeBinding(DialogBlock, {
  field: 'deleteDialog',
  init: { contextToArgs: () => [{ id: 'delete-song-dialog' }] },
}).withOutMessagePolicy({ fold: foldDeleteDialogOutMessage })

export const HomeComposition = HomeDefinition.makeComposition({
  bindings: [DeleteDialogBinding],
})
export type HomeViewBuilder = Block.ViewBuilderFor<typeof HomeComposition>

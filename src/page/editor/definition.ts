import { Block } from 'foldkit'

import { Message, OutMessage } from './message'
import { Model } from './model'

export const EditorDefinition = Block.makeDefinition('Editor', {
  Model,
  Message,
  OutMessage,
})

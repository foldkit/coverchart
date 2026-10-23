import { Block } from 'foldkit'

import { Message, OutMessage } from './message'
import { Model } from './model'

export const PlayDefinition = Block.makeDefinition('Play', {
  Model,
  Message,
  OutMessage,
})

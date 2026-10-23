import { Block } from 'foldkit'

import { EffectsLayer } from './command'
import { PlayComposition } from './composition'
import { init } from './init'
import { Model } from './model'
import { update } from './update'
import { view } from './view'

const prepare = () =>
  PlayComposition.prepareBlock({
    init,
    update,
    view,
    EffectsLayer,
  })
export const PlayBlock: Block.FromAssemblyWithViewAndOutMessage<
  typeof Model,
  typeof prepare
> = Block.assemble(prepare)

import { Block } from 'foldkit'

import { EffectsLayer } from './command'
import { EditorComposition } from './composition'
import { init } from './init'
import { Model } from './model'
import { update } from './update'
import { view } from './view'

const prepare = () =>
  EditorComposition.prepareBlock({
    init,
    update,
    view,
    EffectsLayer,
  })
export const EditorBlock: Block.FromAssemblyWithViewAndOutMessage<
  typeof Model,
  typeof prepare
> = Block.assemble(prepare)

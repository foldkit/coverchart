import { Block } from 'foldkit'

import { HomeComposition } from './composition'
import { init } from './init'
import { Model } from './model'
import { update } from './update'
import { view } from './view'

const prepare = () => HomeComposition.prepareBlock({ init, update, view })
export const HomeBlock: Block.FromAssemblyWithViewAndOutMessage<
  typeof Model,
  typeof prepare
> = Block.assemble(prepare)

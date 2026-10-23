import type { Block } from 'foldkit'

import { PlayDefinition } from './definition'

export const PlayComposition = PlayDefinition.makeComposition()
export type PlayViewBuilder = Block.ViewBuilderFor<typeof PlayComposition>

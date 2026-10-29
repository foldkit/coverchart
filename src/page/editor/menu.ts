import { Menu } from '@foldkit/ui'

import { Section } from '../../domain'

export const AddSectionMenuBlock =
  Menu.makeBlock<typeof Section.SectionKind.Type>()
export const ChordMenuBlock = Menu.makeBlock<string>()

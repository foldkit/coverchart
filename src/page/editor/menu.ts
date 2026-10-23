import { Menu } from '@foldkit/ui'

import { Section } from '../../domain'

export const AddSectionMenuBlock =
  Menu.create<typeof Section.SectionKind.Type>()
export const ChordMenuBlock = Menu.create<string>()

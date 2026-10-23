import { Option } from 'effect'

import { EditorComposition } from './composition'
import { Announcement, EditorMode } from './model'

export const init = EditorComposition.makeInit(() => ({
  model: {
    mode: EditorMode.Viewing(),
    paletteDraft: '',
    maybePendingDeleteSectionId: Option.none(),
    announcement: Announcement.None(),
  },
}))

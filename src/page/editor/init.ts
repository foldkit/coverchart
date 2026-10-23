import { Option } from 'effect'

import { Song } from '../../domain'
import { EditorComposition } from './composition'
import { EditorMode } from './model'

export const init = EditorComposition.makeInit((song: Song.Song) => ({
  model: {
    song,
    mode: EditorMode.Viewing(),
    paletteDraft: '',
    maybePendingDeleteSectionId: Option.none(),
    announcement: '',
  },
}))

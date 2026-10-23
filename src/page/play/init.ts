import { Song } from '../../domain'
import { PlayComposition } from './composition'

export const init = PlayComposition.makeInit((song: Song.Song) => ({
  model: { song },
}))

import { Schema } from 'effect'

import { PLACEHOLDER_SECTION_ID, PLACEHOLDER_SONG_ID } from '../../constant'
import { Song } from '../../domain'

export const Model = Schema.Struct({
  song: Song.Song,
})

export type Model = typeof Model.Type

export const placeholderSong = Song.create(
  PLACEHOLDER_SONG_ID,
  PLACEHOLDER_SECTION_ID,
)

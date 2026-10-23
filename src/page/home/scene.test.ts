import { expect, given, role, scene, withViewInputs } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Song } from '../../domain'
import { init } from './init'
import { update } from './update'
import { view } from './view'

const homeInit = init()

const untitled = Song.create('song-1', 'section-1')

describe('home view', () => {
  test('lists saved songs', () => {
    scene(
      { update, view: withViewInputs(view, { songs: [untitled] })() },
      given(homeInit.model),
      expect(role('heading', { name: 'Coverchart' })).toExist(),
      expect(role('link', { name: 'Untitled' })).toExist(),
      expect(role('link', { name: 'Edit' })).toExist(),
      expect(role('link', { name: 'Play' })).toExist(),
    )
  })
})

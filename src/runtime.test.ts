import { Array, Crypto, Deferred, Effect, Layer, Option } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Program, Runtime } from 'foldkit'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test, vi } from 'vitest'

import { BrowserCrypto } from '@effect/platform-browser'

import { ApplicationBlock } from './block'
import { Song } from './domain'
import { Flags } from './flags'

const buttonNamed = (container: Element, name: string) =>
  Option.getOrThrow(
    Array.findFirst(
      Array.fromIterable(container.querySelectorAll('button')),
      button => button.textContent === name,
    ),
  )

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

describe('editor occurrence lifetime', () => {
  test.each([
    {
      name: 'the current visit accepts its result',
      shouldReopen: false,
      expectedSections: 2,
    },
    {
      name: 'a reopened visit rejects the earlier result',
      shouldReopen: true,
      expectedSections: 1,
    },
  ])('$name', async ({ shouldReopen, expectedSections }) => {
    const started = await Effect.runPromise(Deferred.make<void>())
    const released = await Effect.runPromise(Deferred.make<void>())
    const finished = await Effect.runPromise(Deferred.make<void>())
    const DelayedCryptoLayer = Layer.effect(
      Crypto.Crypto,
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto
        return {
          ...crypto,
          randomUUIDv4: Effect.gen(function* () {
            yield* Deferred.succeed(started, undefined)
            yield* Deferred.await(released)
            const id = yield* crypto.randomUUIDv4
            return id
          }).pipe(Effect.ensuring(Deferred.succeed(finished, undefined))),
        }
      }),
    ).pipe(Layer.provide(BrowserCrypto.layer))
    const ApplicationTestLayer = Layer.mergeAll(
      DelayedCryptoLayer,
      KeyValueStore.layerMemory,
    )
    const first = modifyFields(Song.create('song-1', 'section-1'), {
      title: () => 'Song A',
    })
    const second = modifyFields(Song.create('song-2', 'section-2'), {
      title: () => 'Song B',
    })
    const originalUrl = window.location.href
    const host = document.createElement('div')
    const container = document.createElement('div')
    container.id = 'coverchart-runtime-test'
    host.appendChild(container)
    document.body.appendChild(host)
    window.history.replaceState({}, '', '/songs/song-1')

    const program = Program.make({
      block: ApplicationBlock,
      Flags,
      container,
      routing: {
        onUrlRequest: ApplicationBlock.Message.ClickedLink,
        onUrlChange: ApplicationBlock.Message.ChangedUrl,
      },
      devTools: false,
      slow: false,
    })
    const handle = Runtime.embed(program.provide(ApplicationTestLayer), {
      flags: Effect.succeed(
        Flags.make({
          maybeSavedLibrary: Option.some({ songs: [first, second] }),
          maybeThemePreference: Option.some('Light'),
          systemTheme: 'Light',
        }),
      ),
    })

    try {
      await vi.waitFor(() =>
        expect(host.querySelector('h1')?.textContent).toBe('Song A'),
      )
      buttonNamed(host, 'Duplicate').click()
      await Effect.runPromise(Deferred.await(started))

      if (shouldReopen) {
        window.history.pushState({}, '', '/songs/song-2')
        window.dispatchEvent(new PopStateEvent('popstate'))
        await vi.waitFor(() =>
          expect(host.querySelector('h1')?.textContent).toBe('Song B'),
        )

        window.history.pushState({}, '', '/songs/song-1')
        window.dispatchEvent(new PopStateEvent('popstate'))
        await vi.waitFor(() =>
          expect(host.querySelector('h1')?.textContent).toBe('Song A'),
        )
      }
      await Effect.runPromise(Deferred.succeed(released, undefined))
      await Effect.runPromise(Deferred.await(finished))
      await nextFrame()
      await nextFrame()

      expect(
        Array.fromIterable(host.querySelectorAll('h2')).filter(
          heading => heading.textContent === 'Verse',
        ),
      ).toHaveLength(expectedSections)
      expect(host.querySelector('h1')?.textContent).toBe('Song A')
    } finally {
      handle.dispose()
      window.history.replaceState({}, '', originalUrl)
      await vi.waitFor(() => expect(host.querySelector('h1')).toBeNull())
      host.remove()
    }
  })
})

import { Option } from 'effect'
import { Update } from 'foldkit'
import type { Block } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { GenerateSongIds, SaveLibrary } from './command'
import { PLACEHOLDER_SECTION_ID, PLACEHOLDER_SONG_ID } from './constant'
import { ApplicationDefinition } from './definition'
import { Song } from './domain'
import { EditorBlock, HomeBlock, PlayBlock } from './page'
import { ToastBlock } from './toast'

const placeholderSong = Song.create(PLACEHOLDER_SONG_ID, PLACEHOLDER_SECTION_ID)

export const HomeBinding = ApplicationDefinition.makeBinding(HomeBlock, {
  field: 'home',
})

export const EditorBinding = ApplicationDefinition.makeBinding(EditorBlock, {
  field: 'editor',
  init: { contextToArgs: song => [song] },
  subscriptions: {
    when: model => model.route._tag === 'SongEdit',
  },
})

export const PlayBinding = ApplicationDefinition.makeBinding(PlayBlock, {
  field: 'play',
  init: { contextToArgs: song => [song] },
})

export const ToastBinding = ApplicationDefinition.makeBinding(ToastBlock, {
  field: 'toast',
  init: { contextToArgs: () => [{ id: 'app-toast' }] },
})

const saveSongs = (songs: ReadonlyArray<Song.Song>) =>
  ApplicationDefinition.makeStep(model => ({
    model: modifyFields(model, { songs: () => songs }),
    commands: [SaveLibrary({ songs })],
  }))

const resetEditor = (songId: string) =>
  ApplicationDefinition.makeStep(model =>
    model.editor.song.id === songId
      ? EditorBinding.init({
          args: [placeholderSong],
          toParentModel: editor =>
            modifyFields(model, { editor: () => editor }),
        })
      : { model },
  )

const resetPlay = (songId: string) =>
  ApplicationDefinition.makeStep(model =>
    model.play.song.id === songId
      ? PlayBinding.init({
          args: [placeholderSong],
          toParentModel: play => modifyFields(model, { play: () => play }),
        })
      : { model },
  )

const foldHomeOutMessage = ApplicationDefinition.makeOutMessageFold(HomeBlock, {
  RequestedNewSong: () =>
    ApplicationDefinition.makeStep(model => ({
      model,
      commands: [GenerateSongIds()],
    })),
  ConfirmedDeleteSong: ({ songId }) =>
    Update.combineSteps([
      resetEditor(songId),
      resetPlay(songId),
      ApplicationDefinition.makeStep(model =>
        saveSongs(Song.remove(model.songs, songId))(model),
      ),
    ]),
})

const HomeBindingWithOutMessagePolicy = HomeBinding.withOutMessagePolicy({
  fold: foldHomeOutMessage,
})

const foldEditorOutMessage = ApplicationDefinition.makeOutMessageFold(
  EditorBlock,
  {
    UpdatedSong: ({ song }) =>
      Update.combineSteps([
        EditorBinding.informSongChanged({ song }),
        PlayBinding.informSongChanged({ song }),
        ApplicationDefinition.makeStep(model =>
          saveSongs(Song.upsert(model.songs, song))(model),
        ),
      ]),
  },
)

const EditorBindingWithOutMessagePolicy = EditorBinding.withOutMessagePolicy({
  fold: foldEditorOutMessage,
})

const showToast = (
  variant: 'Success' | 'Error',
  title: string,
  maybeDescription: Option.Option<string> = Option.none(),
) =>
  ToastBinding.requestShow({
    variant,
    payload: { title, maybeDescription },
  })

const foldPlayOutMessage = ApplicationDefinition.makeOutMessageFold(PlayBlock, {
  UpdatedSong: ({ song }) =>
    Update.combineSteps([
      EditorBinding.informSongChanged({ song }),
      PlayBinding.informSongChanged({ song }),
      ApplicationDefinition.makeStep(model =>
        saveSongs(Song.upsert(model.songs, song))(model),
      ),
    ]),
  CopiedChart: () => showToast('Success', 'Chart copied'),
  FailedCopy: ({ error }) => showToast('Error', error),
})

const PlayBindingWithOutMessagePolicy = PlayBinding.withOutMessagePolicy({
  fold: foldPlayOutMessage,
})

const foldToastOutMessage = ApplicationDefinition.makeOutMessageFold(
  ToastBlock,
  {
    DismissedToast: ApplicationDefinition.makeNoopStep,
  },
)

const ToastBindingWithOutMessagePolicy = ToastBinding.withOutMessagePolicy({
  fold: foldToastOutMessage,
})

export const ApplicationComposition = ApplicationDefinition.makeComposition({
  bindings: [
    HomeBindingWithOutMessagePolicy,
    EditorBindingWithOutMessagePolicy,
    PlayBindingWithOutMessagePolicy,
    ToastBindingWithOutMessagePolicy,
  ],
})
export type ApplicationViewBuilder = Block.ViewBuilderFor<
  typeof ApplicationComposition
>

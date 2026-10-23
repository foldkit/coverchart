import { Array, Effect, Option, Schema, String, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'

import * as Chord from './chord'
import * as Line from './line'
import { Section, SectionKind } from './section'
import * as SectionModule from './section'

export const Song = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artist: Schema.String,
  maybeOriginalKey: Schema.Option(Schema.String),
  transpose: Schema.Number,
  capo: Schema.Number,
  chords: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultTypeKey(
      Effect.succeed<ReadonlyArray<string>>([]),
    ),
  ),
  sections: Schema.Array(Section),
})

export const create = (id: string, sectionId: string): typeof Song.Type => ({
  id,
  title: '',
  artist: '',
  maybeOriginalKey: Option.none(),
  transpose: 0,
  capo: 0,
  chords: [],
  sections: [SectionModule.empty(sectionId, 'Verse')],
})

export const displayTitle = (song: typeof Song.Type): string =>
  pipe(song.title, String.trim, title =>
    String.isNonEmpty(title) ? title : 'Untitled',
  )

export const findById = (
  songs: ReadonlyArray<typeof Song.Type>,
  songId: string,
): Option.Option<typeof Song.Type> =>
  Array.findFirst(songs, ({ id }) => id === songId)

export const upsert = (
  songs: ReadonlyArray<typeof Song.Type>,
  song: typeof Song.Type,
): ReadonlyArray<typeof Song.Type> =>
  Option.match(
    Array.findFirstIndex(songs, ({ id }) => id === song.id),
    {
      onNone: () => Array.prepend(songs, song),
      onSome: index =>
        Option.getOrElse(Array.replace(songs, index, song), () =>
          Array.prepend(songs, song),
        ),
    },
  )

export const remove = (
  songs: ReadonlyArray<typeof Song.Type>,
  songId: string,
): ReadonlyArray<typeof Song.Type> =>
  Array.filter(songs, ({ id }) => id !== songId)

export const addChord = (
  song: typeof Song.Type,
  name: string,
): typeof Song.Type => {
  const chord = pipe(name, String.trim)
  if (pipe(chord, String.isEmpty) || Array.contains(song.chords, chord)) {
    return song
  }

  return modifyFields(song, { chords: Array.append(chord) })
}

export const removeChord = (
  song: typeof Song.Type,
  name: string,
): typeof Song.Type =>
  modifyFields(song, { chords: Array.filter(chord => chord !== name) })

export const matchesQuery = (
  song: typeof Song.Type,
  query: string,
): boolean => {
  const normalized = pipe(query, String.trim, String.toLowerCase)
  if (pipe(normalized, String.isEmpty)) {
    return true
  }

  const haystack = pipe(`${song.title} ${song.artist}`, String.toLowerCase)

  return haystack.includes(normalized)
}

export const filterByQuery = (
  songs: ReadonlyArray<typeof Song.Type>,
  query: string,
): ReadonlyArray<typeof Song.Type> =>
  Array.filter(songs, song => matchesQuery(song, query))

export const updateSection = (
  song: typeof Song.Type,
  sectionId: string,
  f: (section: typeof Section.Type) => typeof Section.Type,
): typeof Song.Type =>
  modifyFields(song, {
    sections: Array.map(section =>
      section.id === sectionId ? f(section) : section,
    ),
  })

export const findSection = (
  song: typeof Song.Type,
  sectionId: string,
): Option.Option<typeof Section.Type> =>
  Array.findFirst(song.sections, ({ id }) => id === sectionId)

export const addSection = (
  song: typeof Song.Type,
  section: typeof Section.Type,
): typeof Song.Type => modifyFields(song, { sections: Array.append(section) })

export const insertSectionAfter = (
  song: typeof Song.Type,
  afterSectionId: string,
  section: typeof Section.Type,
): typeof Song.Type =>
  pipe(
    Array.findFirstIndex(song.sections, ({ id }) => id === afterSectionId),
    Option.flatMap(index => Array.insertAt(song.sections, index + 1, section)),
    Option.match({
      onNone: () => addSection(song, section),
      onSome: sections => modifyFields(song, { sections: () => sections }),
    }),
  )

export const removeSection = (
  song: typeof Song.Type,
  sectionId: string,
): typeof Song.Type => {
  const remaining = Array.filter(song.sections, ({ id }) => id !== sectionId)
  return Array.match(remaining, {
    onEmpty: () => song,
    onNonEmpty: sections => modifyFields(song, { sections: () => sections }),
  })
}

export const reorderSections = (
  song: typeof Song.Type,
  itemId: string,
  toIndex: number,
): typeof Song.Type =>
  modifyFields(song, {
    sections: sections => SectionModule.reorder(sections, itemId, toIndex),
  })

export const setKind = (
  song: typeof Song.Type,
  sectionId: string,
  kind: typeof SectionKind.Type,
): typeof Song.Type =>
  updateSection(song, sectionId, section =>
    modifyFields(section, { kind: () => kind }),
  )

export const updateLine = (
  song: typeof Song.Type,
  lineId: string,
  f: (line: typeof Line.LyricLine.Type) => typeof Line.LyricLine.Type,
): typeof Song.Type =>
  modifyFields(song, {
    sections: Array.map(section =>
      SectionModule.updateLine(section, lineId, f),
    ),
  })

export const findLine = (
  song: typeof Song.Type,
  lineId: string,
): Option.Option<typeof Line.LyricLine.Type> =>
  pipe(
    song.sections,
    Array.findFirst(section =>
      Option.isSome(SectionModule.findLine(section, lineId)),
    ),
    Option.flatMap(section => SectionModule.findLine(section, lineId)),
  )

const padRight = (text: string, width: number): string =>
  text.length >= width ? text : text + ' '.repeat(width - text.length)

const formatLine = (
  line: typeof Line.LyricLine.Type,
  transposeSteps: number,
  capo: number,
): string => {
  const chordRow = Array.reduce(line.marks, '', (row, mark) => {
    const name = Chord.displayName(mark.name, transposeSteps, capo)
    const padded = padRight(row, mark.at)
    return `${padded}${name}`
  })

  return pipe(chordRow, String.trimEnd, chords =>
    String.isNonEmpty(chords) ? `${chords}\n${line.lyric}` : line.lyric,
  )
}

const formatSection = (
  section: typeof Section.Type,
  transposeSteps: number,
  capo: number,
): string => {
  const heading = `[${SectionModule.kindLabel(section.kind)}]`
  return Array.match(section.lines, {
    onEmpty: () => heading,
    onNonEmpty: lines =>
      pipe(
        lines,
        Array.map(line => formatLine(line, transposeSteps, capo)),
        Array.join('\n'),
        body => `${heading}\n${body}`,
      ),
  })
}

export const toChartText = (song: typeof Song.Type): string => {
  const title = displayTitle(song)
  const artistLine = pipe(song.artist, String.trim)
  const keyLine = Option.match(song.maybeOriginalKey, {
    onNone: () => '',
    onSome: key => `Key: ${key}`,
  })
  const capoLine = song.capo > 0 ? `Capo: ${song.capo}` : ''
  const transposeLine =
    song.transpose === 0
      ? ''
      : `Transpose: ${song.transpose > 0 ? '+' : ''}${globalThis.String(song.transpose)}`

  const header = pipe(
    [title, artistLine, keyLine, capoLine, transposeLine],
    Array.filter(String.isNonEmpty),
    Array.join('\n'),
  )

  const body = pipe(
    song.sections,
    Array.map(section => formatSection(section, song.transpose, song.capo)),
    Array.join('\n\n'),
  )

  return Array.match(pipe([header, body], Array.filter(String.isNonEmpty)), {
    onEmpty: () => title,
    onNonEmpty: parts => Array.join(parts, '\n\n'),
  })
}

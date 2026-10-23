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

export type Song = typeof Song.Type

export const create = (id: string, sectionId: string): Song => ({
  id,
  title: '',
  artist: '',
  maybeOriginalKey: Option.none(),
  transpose: 0,
  capo: 0,
  chords: [],
  sections: [SectionModule.empty(sectionId, 'Verse')],
})

export const displayTitle = (song: Song): string =>
  pipe(song.title, String.trim, title =>
    String.isNonEmpty(title) ? title : 'Untitled',
  )

export const findById = (
  songs: ReadonlyArray<Song>,
  songId: string,
): Option.Option<Song> => Array.findFirst(songs, ({ id }) => id === songId)

export const upsert = (
  songs: ReadonlyArray<Song>,
  song: Song,
): ReadonlyArray<Song> =>
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
  songs: ReadonlyArray<Song>,
  songId: string,
): ReadonlyArray<Song> => Array.filter(songs, ({ id }) => id !== songId)

export const addChord = (song: Song, name: string): Song => {
  const chord = pipe(name, String.trim)
  if (pipe(chord, String.isEmpty) || Array.contains(song.chords, chord)) {
    return song
  }

  return modifyFields(song, { chords: Array.append(chord) })
}

export const removeChord = (song: Song, name: string): Song =>
  modifyFields(song, { chords: Array.filter(chord => chord !== name) })

export const matchesQuery = (song: Song, query: string): boolean => {
  const normalized = pipe(query, String.trim, String.toLowerCase)
  if (pipe(normalized, String.isEmpty)) {
    return true
  }

  const haystack = pipe(`${song.title} ${song.artist}`, String.toLowerCase)

  return haystack.includes(normalized)
}

export const filterByQuery = (
  songs: ReadonlyArray<Song>,
  query: string,
): ReadonlyArray<Song> => Array.filter(songs, song => matchesQuery(song, query))

export const updateSection = (
  song: Song,
  sectionId: string,
  f: (section: Section) => Section,
): Song =>
  modifyFields(song, {
    sections: Array.map(section =>
      section.id === sectionId ? f(section) : section,
    ),
  })

export const findSection = (
  song: Song,
  sectionId: string,
): Option.Option<Section> =>
  Array.findFirst(song.sections, ({ id }) => id === sectionId)

export const addSection = (song: Song, section: Section): Song =>
  modifyFields(song, { sections: Array.append(section) })

export const insertSectionAfter = (
  song: Song,
  afterSectionId: string,
  section: Section,
): Song =>
  pipe(
    Array.findFirstIndex(song.sections, ({ id }) => id === afterSectionId),
    Option.flatMap(index => Array.insertAt(song.sections, index + 1, section)),
    Option.match({
      onNone: () => addSection(song, section),
      onSome: sections => modifyFields(song, { sections: () => sections }),
    }),
  )

export const removeSection = (song: Song, sectionId: string): Song => {
  const remaining = Array.filter(song.sections, ({ id }) => id !== sectionId)
  return Array.match(remaining, {
    onEmpty: () => song,
    onNonEmpty: sections => modifyFields(song, { sections: () => sections }),
  })
}

export const reorderSections = (
  song: Song,
  itemId: string,
  toIndex: number,
): Song =>
  modifyFields(song, {
    sections: sections => SectionModule.reorder(sections, itemId, toIndex),
  })

export const setKind = (
  song: Song,
  sectionId: string,
  kind: SectionKind,
): Song =>
  updateSection(song, sectionId, section =>
    modifyFields(section, { kind: () => kind }),
  )

export const updateLine = (
  song: Song,
  lineId: string,
  f: (line: Line.LyricLine) => Line.LyricLine,
): Song =>
  modifyFields(song, {
    sections: Array.map(section =>
      SectionModule.updateLine(section, lineId, f),
    ),
  })

export const findLine = (
  song: Song,
  lineId: string,
): Option.Option<Line.LyricLine> =>
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
  line: Line.LyricLine,
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
  section: Section,
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

export const toChartText = (song: Song): string => {
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

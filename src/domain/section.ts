import { Array, Option, Schema, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { LyricLine } from './line'
import * as Line from './line'

export const SectionKind = Schema.Literals([
  'Intro',
  'Verse',
  'PreChorus',
  'Chorus',
  'Bridge',
  'Solo',
  'Outro',
  'Instrumental',
])

export const SECTION_KINDS: ReadonlyArray<typeof SectionKind.Type> = [
  'Intro',
  'Verse',
  'PreChorus',
  'Chorus',
  'Bridge',
  'Solo',
  'Outro',
  'Instrumental',
]

export const kindLabel = (kind: typeof SectionKind.Type): string =>
  kind === 'PreChorus' ? 'Pre-Chorus' : kind

export const Section = Schema.Struct({
  id: Schema.String,
  kind: SectionKind,
  lines: Schema.Array(LyricLine),
})

export const empty = (
  id: string,
  kind: typeof SectionKind.Type,
): typeof Section.Type => ({
  id,
  kind,
  lines: [],
})

export const lyricsText = (section: typeof Section.Type): string =>
  pipe(
    section.lines,
    Array.map(({ lyric }) => lyric),
    Array.join('\n'),
  )

const draftLines = (draft: string): ReadonlyArray<string> => draft.split('\n')

const lineIdAt = (sectionId: string, index: number): string =>
  `${sectionId}:${String(index)}`

export const replaceLyrics = (
  section: typeof Section.Type,
  draft: string,
): typeof Section.Type => {
  const lines = pipe(
    draftLines(draft),
    Array.map((lyric, index) =>
      Option.match(Array.get(section.lines, index), {
        onNone: () => Line.empty(lineIdAt(section.id, index), lyric),
        onSome: previous =>
          previous.lyric === lyric
            ? previous
            : Line.empty(lineIdAt(section.id, index), lyric),
      }),
    ),
  )

  return modifyFields(section, { lines: () => lines })
}

export const updateLine = (
  section: typeof Section.Type,
  lineId: string,
  f: (line: typeof Line.LyricLine.Type) => typeof Line.LyricLine.Type,
): typeof Section.Type =>
  modifyFields(section, {
    lines: Array.map(line => (line.id === lineId ? f(line) : line)),
  })

export const findLine = (
  section: typeof Section.Type,
  lineId: string,
): Option.Option<typeof Line.LyricLine.Type> =>
  Array.findFirst(section.lines, ({ id }) => id === lineId)

const markCount = (section: typeof Section.Type): number =>
  pipe(
    section.lines,
    Array.flatMap(({ marks }) => marks),
    Array.length,
  )

export const duplicateIdCount = (section: typeof Section.Type): number =>
  1 + section.lines.length + markCount(section)

type DuplicateAcc = Readonly<{
  lines: ReadonlyArray<typeof Line.LyricLine.Type>
  remainingIds: ReadonlyArray<string>
}>

const duplicateMarks = (
  marks: ReadonlyArray<typeof Line.ChordMark.Type>,
  remainingIds: ReadonlyArray<string>,
): Readonly<{
  marks: ReadonlyArray<typeof Line.ChordMark.Type>
  remainingIds: ReadonlyArray<string>
}> =>
  Array.reduce(
    marks,
    {
      marks: Array.empty<typeof Line.ChordMark.Type>(),
      remainingIds,
    },
    (acc, mark) =>
      Option.match(Array.head(acc.remainingIds), {
        onNone: () => acc,
        onSome: id => ({
          marks: Array.append(acc.marks, modifyFields(mark, { id: () => id })),
          remainingIds: Array.drop(acc.remainingIds, 1),
        }),
      }),
  )

export const duplicate = (
  section: typeof Section.Type,
  ids: ReadonlyArray<string>,
): Option.Option<typeof Section.Type> =>
  Option.map(Array.head(ids), sectionId => {
    const afterSection = Array.drop(ids, 1)
    const duplicateInitial: DuplicateAcc = {
      lines: [],
      remainingIds: afterSection,
    }
    const next = Array.reduce(
      section.lines,
      duplicateInitial,
      (acc: DuplicateAcc, line): DuplicateAcc =>
        Option.match(Array.head(acc.remainingIds), {
          onNone: () => acc,
          onSome: lineId => {
            const afterLine = Array.drop(acc.remainingIds, 1)
            const duplicatedMarks = duplicateMarks(line.marks, afterLine)
            return {
              lines: Array.append(acc.lines, {
                id: lineId,
                lyric: line.lyric,
                marks: duplicatedMarks.marks,
              }),
              remainingIds: duplicatedMarks.remainingIds,
            }
          },
        }),
    )

    return {
      id: sectionId,
      kind: section.kind,
      lines: next.lines,
    }
  })

export const reorder = (
  sections: ReadonlyArray<typeof Section.Type>,
  itemId: string,
  toIndex: number,
): ReadonlyArray<typeof Section.Type> =>
  pipe(
    Array.findFirstIndex(sections, ({ id }) => id === itemId),
    Option.flatMap(fromIndex =>
      pipe(
        Array.get(sections, fromIndex),
        Option.flatMap(section =>
          Array.insertAt(Array.remove(sections, fromIndex), toIndex, section),
        ),
      ),
    ),
    Option.getOrElse(() => sections),
  )

import { Array, Option, Order, Schema, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'

export const ChordMark = Schema.Struct({
  id: Schema.String,
  at: Schema.Number,
  name: Schema.String,
})

export const LyricLine = Schema.Struct({
  id: Schema.String,
  lyric: Schema.String,
  marks: Schema.Array(ChordMark),
})

export type Word = Readonly<{
  start: number
  text: string
}>

export const empty = (id: string, lyric = ''): typeof LyricLine.Type => ({
  id,
  lyric,
  marks: [],
})

export const words = (lyric: string): ReadonlyArray<Word> =>
  pipe(
    Array.fromIterable(lyric.matchAll(/\S+/g)),
    Array.flatMap(match =>
      Option.match(Option.fromNullishOr(match.index), {
        onNone: () => [],
        onSome: start => [{ start, text: match[0] ?? '' }],
      }),
    ),
  )

export const markAt = (
  line: typeof LyricLine.Type,
  at: number,
): Option.Option<typeof ChordMark.Type> =>
  Array.findFirst(line.marks, mark => mark.at === at)

export const upsertMark = (
  line: typeof LyricLine.Type,
  mark: typeof ChordMark.Type,
): typeof LyricLine.Type =>
  modifyFields(line, {
    marks: marks =>
      pipe(
        marks,
        Array.filter(({ at, id }) => at !== mark.at && id !== mark.id),
        Array.append(mark),
        Array.sortWith(mark => mark.at, Order.Number),
      ),
  })

export const updateMarkName = (
  line: typeof LyricLine.Type,
  markId: string,
  name: string,
): typeof LyricLine.Type =>
  modifyFields(line, {
    marks: Array.map(mark =>
      mark.id === markId ? modifyFields(mark, { name: () => name }) : mark,
    ),
  })

export const removeMark = (
  line: typeof LyricLine.Type,
  markId: string,
): typeof LyricLine.Type =>
  modifyFields(line, {
    marks: Array.filter(({ id }) => id !== markId),
  })

export const setLyric = (
  line: typeof LyricLine.Type,
  lyric: string,
): typeof LyricLine.Type => {
  const nextStarts = pipe(
    words(lyric),
    Array.map(({ start }) => start),
  )

  return modifyFields(line, {
    lyric: () => lyric,
    marks: Array.filter(({ at }) => Array.contains(nextStarts, at)),
  })
}

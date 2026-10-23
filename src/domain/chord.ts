import { Array, Option, String, pipe } from 'effect'

const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

const FLAT_TO_SHARP: Readonly<Record<string, string>> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
}

const PITCH_PATTERN = /^([A-G](?:#|b)?)(.*)$/

const UNTRANSPOSABLE_NAMES: ReadonlyArray<string> = ['N.C.', 'NC', 'n.c.', 'nc']

const wrapSemitone = (value: number): number => {
  const remainder = value % 12
  return remainder < 0 ? remainder + 12 : remainder
}

const transposePitchToken = (token: string, semitones: number): string => {
  const maybeParts = Option.fromNullishOr(PITCH_PATTERN.exec(token))

  return Option.match(maybeParts, {
    onNone: () => token,
    onSome: parts => {
      const root = parts[1] ?? token
      const suffix = parts[2] ?? ''
      const usesFlat = root.includes('b')
      const sharpRoot = FLAT_TO_SHARP[root] ?? root
      const maybeIndex = pipe(
        SHARP_NAMES,
        Array.findFirstIndex(name => name === sharpRoot),
      )

      return Option.match(maybeIndex, {
        onNone: () => token,
        onSome: index => {
          const nextIndex = wrapSemitone(index + semitones)
          const names = usesFlat ? FLAT_NAMES : SHARP_NAMES
          return `${names[nextIndex] ?? root}${suffix}`
        },
      })
    },
  })
}

export const transpose = (name: string, semitones: number): string => {
  const trimmed = pipe(name, String.trim)

  if (
    pipe(trimmed, String.isEmpty) ||
    Array.contains(UNTRANSPOSABLE_NAMES, trimmed)
  ) {
    return name
  }

  const slashIndex = trimmed.indexOf('/')
  if (slashIndex === -1) {
    return transposePitchToken(trimmed, semitones)
  }

  const rootPart = trimmed.slice(0, slashIndex)
  const bassPart = trimmed.slice(slashIndex + 1)
  return `${transposePitchToken(rootPart, semitones)}/${transposePitchToken(bassPart, semitones)}`
}

export const displayName = (
  name: string,
  transposeSteps: number,
  capo: number,
): string => transpose(name, transposeSteps - capo)

import type { RootNote } from "./types";

/**
 * Canonical chromatic representation.
 *
 * We use sharps internally for pitch calculations.
 */
export const CHROMATIC_SHARPS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/**
 * Flat spellings mapped to their pitch classes.
 */
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

/**
 * Convert any supported note name into a pitch class.
 *
 * Example:
 *
 * C  -> 0
 * C# -> 1
 * Db -> 1
 * Bb -> 10
 */
export function noteToPitchClass(
  note: RootNote
): number {
  const normalized =
    FLAT_TO_SHARP[note] ?? note;

  const index =
    CHROMATIC_SHARPS.indexOf(
      normalized as (typeof CHROMATIC_SHARPS)[number]
    );

  if (index === -1) {
    throw new Error(
      `Unknown note: ${note}`
    );
  }

  return index;
}

/**
 * Convert pitch class to a note name.
 *
 * By default we use sharps.
 */
export function pitchClassToSharp(
  pitchClass: number
): string {
  const normalized =
    ((pitchClass % 12) + 12) % 12;

  return CHROMATIC_SHARPS[normalized];
}

/**
 * Convert pitch class to a flat-friendly spelling.
 */
export function pitchClassToFlat(
  pitchClass: number
): string {
  const normalized =
    ((pitchClass % 12) + 12) % 12;

  const flats: Record<number, string> = {
    0: "C",
    1: "Db",
    2: "D",
    3: "Eb",
    4: "E",
    5: "F",
    6: "Gb",
    7: "G",
    8: "Ab",
    9: "A",
    10: "Bb",
    11: "B",
  };

  return flats[normalized];
}

/**
 * Decide whether a note should be displayed using flats.
 *
 * This keeps the notation reasonably musical for common flat keys.
 */
export function shouldUseFlats(
  root: RootNote
): boolean {
  return [
    "F",
    "Bb",
    "Eb",
    "Ab",
    "Db",
    "Gb",
  ].includes(root);
}

/**
 * Convert MIDI to a display note.
 *
 * Example:
 *
 * 60 -> C4
 * 61 -> C#4
 * 70 -> Bb4 when flat mode is requested
 */
export function midiToNote(
  midi: number,
  preferFlats = false
): string {
  const pitchClass =
    ((midi % 12) + 12) % 12;

  const octave =
    Math.floor(midi / 12) - 1;

  const noteName = preferFlats
    ? pitchClassToFlat(pitchClass)
    : pitchClassToSharp(pitchClass);

  return `${noteName}${octave}`;
}

/**
 * Convert a root note + octave into MIDI.
 *
 * MIDI:
 *
 * C-1 = 0
 * C0  = 12
 * C4  = 60
 */
export function noteToMidi(
  note: RootNote,
  octave: number
): number {
  const pitchClass =
    noteToPitchClass(note);

  return 12 * (octave + 1) + pitchClass;
}

/**
 * Convert a note string such as:
 *
 * C4
 * Bb3
 * F#5
 *
 * into MIDI.
 */
export function noteStringToMidi(
  note: string
): number {
  const match =
    note.match(/^([A-G](?:#|b)?)(-?\d+)$/);

  if (!match) {
    throw new Error(
      `Invalid note: ${note}`
    );
  }

  const noteName =
    match[1] as RootNote;

  const octave =
    Number(match[2]);

  return noteToMidi(
    noteName,
    octave
  );
}

/**
 * Convert a note string to a pitch class.
 */
export function noteStringToPitchClass(
  note: string
): number {
  const match =
    note.match(/^([A-G](?:#|b)?)(-?\d+)$/);

  if (!match) {
    throw new Error(
      `Invalid note: ${note}`
    );
  }

  return noteToPitchClass(
    match[1] as RootNote
  );
}

/**
 * Transpose a root note by semitones.
 */
export function transposeRoot(
  root: RootNote,
  semitones: number
): RootNote {
  const pitchClass =
    noteToPitchClass(root);

  const newPitchClass =
    ((pitchClass + semitones) % 12 + 12) % 12;

  const useFlats =
    shouldUseFlats(root);

  return (
    useFlats
      ? pitchClassToFlat(newPitchClass)
      : pitchClassToSharp(newPitchClass)
  ) as RootNote;
}

/**
 * Return the scale's root-relative note.
 *
 * This is used to determine the root of
 * scale degrees.
 */
export function getScaleDegreeRoot(
  key: RootNote,
  scaleIntervals: number[],
  degree: number
): RootNote {
  if (degree < 1) {
    throw new Error(
      "Scale degree must be >= 1"
    );
  }

  const keyPitch =
    noteToPitchClass(key);

  const index =
    (degree - 1) % scaleIntervals.length;

  const interval =
    scaleIntervals[index];

  const pitchClass =
    (keyPitch + interval) % 12;

  const useFlats =
    shouldUseFlats(key);

  return (
    useFlats
      ? pitchClassToFlat(pitchClass)
      : pitchClassToSharp(pitchClass)
  ) as RootNote;
}
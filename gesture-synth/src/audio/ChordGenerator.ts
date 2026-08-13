/*
|--------------------------------------------------------------------------
| ChordGenerator.ts
|--------------------------------------------------------------------------
|
| Converts the current musical gesture state into note names.
|
| This file does NOT:
|
| - play audio
| - import Tone.js
| - access React
| - detect gestures
|
| It only calculates the notes that should be played.
|
|--------------------------------------------------------------------------
*/

export type ChordDegree = "I" | "II" | "III" | "IV" | "V" | "VI" | "VII";

export type ChordQuality = "MAJOR" | "MINOR";

export type ChordShape =
  | "ROOT"
  | "INVERSION"
  | "SEVENTH"
  | "DOMINANT_DIMINISHED";

/*
|--------------------------------------------------------------------------
| MUSICAL STATE
|--------------------------------------------------------------------------
*/

export interface ChordState {
  degree: ChordDegree;

  quality: ChordQuality;

  shape: ChordShape;

  /*
   * Chord-specific semitone shift.
   *
   * MUST remain:
   *
   * -1
   *  0
   * +1
   */

  chordSemitone: number;

  /*
   * Global transpose.
   *
   * Example:
   *
   * +5
   * -2
   */

  transpose: number;

  /*
   * Octave offset.
   *
   * Normal = 0
   * Lower  = -12
   * Higher = +12
   */

  octaveOffset: number;
}

/*
|--------------------------------------------------------------------------
| SCALE
|--------------------------------------------------------------------------
|
| C major scale:
|
| I   C
| II  D
| III E
| IV  F
| V   G
| VI  A
| VII B
|
|--------------------------------------------------------------------------
*/

const SCALE = [
  0, // I
  2, // II
  4, // III
  5, // IV
  7, // V
  9, // VI
  11, // VII
];

/*
|--------------------------------------------------------------------------
| MIDI
|--------------------------------------------------------------------------
|
| C4 = 60
|--------------------------------------------------------------------------
*/

const DEFAULT_ROOT_MIDI = 60;

/*
|--------------------------------------------------------------------------
| CHORD INTERVALS
|--------------------------------------------------------------------------
|
| Major triad:
|
| 0 4 7
|
| Minor triad:
|
| 0 3 7
|
|--------------------------------------------------------------------------
*/

const MAJOR_TRIAD = [0, 4, 7];

const MINOR_TRIAD = [0, 3, 7];

/*
|--------------------------------------------------------------------------
| SEVENTH INTERVALS
|--------------------------------------------------------------------------
|
| For a normal seventh shape we use:
|
| Major 7:
| 0 4 7 11
|
| Minor 7:
| 0 3 7 10
|
|--------------------------------------------------------------------------
*/

const MAJOR_SEVENTH = [0, 4, 7, 11];

const MINOR_SEVENTH = [0, 3, 7, 10];

/*
|--------------------------------------------------------------------------
| DOMINANT / DIMINISHED
|--------------------------------------------------------------------------
|
| This shape is intentionally kept simple for Phase 5.
|
| Dominant:
|
| 0 4 7 10
|
| Diminished:
|
| 0 3 6 9
|
| The current implementation uses the dominant
| structure for the generic DOMINANT_DIMINISHED
| shape.
|
|--------------------------------------------------------------------------
*/

const DOMINANT_SEVENTH = [0, 4, 7, 10];

/*
|--------------------------------------------------------------------------
| NOTE NAMES
|--------------------------------------------------------------------------
*/

const NOTE_NAMES = [
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
];

/*
|--------------------------------------------------------------------------
| MIDI → NOTE NAME
|--------------------------------------------------------------------------
|
| Example:
|
| 60 → C4
| 61 → C#4
| 72 → C5
|
|--------------------------------------------------------------------------
*/

export function midiToNote(midi: number): string {
  const rounded = Math.round(midi);

  const pitchClass = ((rounded % 12) + 12) % 12;

  const octave = Math.floor(rounded / 12) - 1;

  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/*
|--------------------------------------------------------------------------
| NOTE NAME → MIDI
|--------------------------------------------------------------------------
|
| Supports:
|
| C4
| C#4
| D4
| Db4
|
|--------------------------------------------------------------------------
*/

export function noteToMidi(note: string): number {
  const match = note.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);

  if (!match) {
    throw new Error(`Invalid note: ${note}`);
  }

  const letter = match[1].toUpperCase();

  const accidental = match[2];

  const octave = Number(match[3]);

  const baseMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let pitch = baseMap[letter];

  if (accidental === "#") {
    pitch += 1;
  } else if (accidental === "b") {
    pitch -= 1;
  }

  return (octave + 1) * 12 + pitch;
}

/*
|--------------------------------------------------------------------------
| GET DEGREE INDEX
|--------------------------------------------------------------------------
*/

function getDegreeIndex(degree: ChordDegree): number {
  switch (degree) {
    case "I":
      return 0;

    case "II":
      return 1;

    case "III":
      return 2;

    case "IV":
      return 3;

    case "V":
      return 4;

    case "VI":
      return 5;

    case "VII":
      return 6;
  }
}

/*
|--------------------------------------------------------------------------
| GET CHORD ROOT
|--------------------------------------------------------------------------
|
| Everything is currently based around C major.
|
| I   = C
| II  = D
| III = E
| IV  = F
| V   = G
| VI  = A
| VII = B
|
|--------------------------------------------------------------------------
*/

function getChordRoot(degree: ChordDegree): number {
  const degreeIndex = getDegreeIndex(degree);

  return DEFAULT_ROOT_MIDI + SCALE[degreeIndex];
}

/*
|--------------------------------------------------------------------------
| GET BASIC CHORD INTERVALS
|--------------------------------------------------------------------------
*/

function getChordIntervals(quality: ChordQuality, shape: ChordShape): number[] {
  /*
   * ROOT / INVERSION
   *
   * Both start with a triad.
   */

  if (shape === "ROOT" || shape === "INVERSION") {
    return quality === "MAJOR" ? [...MAJOR_TRIAD] : [...MINOR_TRIAD];
  }

  /*
   * SEVENTH
   */

  if (shape === "SEVENTH") {
    return quality === "MAJOR" ? [...MAJOR_SEVENTH] : [...MINOR_SEVENTH];
  }

  /*
   * DOMINANT / DIMINISHED
   */

  return [...DOMINANT_SEVENTH];
}

/*
|--------------------------------------------------------------------------
| APPLY INVERSION
|--------------------------------------------------------------------------
|
| First inversion:
|
| C E G
|
| becomes:
|
| E G C
|
|--------------------------------------------------------------------------
*/

function applyInversion(notes: number[]): number[] {
  if (notes.length < 2) {
    return notes;
  }

  const result = [...notes];

  const first = result.shift();

  if (first === undefined) {
    return result;
  }

  result.push(first + 12);

  return result;
}

/*
|--------------------------------------------------------------------------
| GENERATE CHORD MIDI
|--------------------------------------------------------------------------
*/

export function generateChordMidi(state: ChordState): number[] {
  /*
  |--------------------------------------------------------------------------
  | Clamp chord semitone
  |--------------------------------------------------------------------------
  */

  const chordSemitone = Math.max(
    -1,
    Math.min(1, Math.round(state.chordSemitone)),
  );

  /*
  |--------------------------------------------------------------------------
  | Clamp octave
  |--------------------------------------------------------------------------
  */

  const octaveOffset = Math.round(state.octaveOffset);

  /*
  |--------------------------------------------------------------------------
  | ROOT
  |--------------------------------------------------------------------------
  */

  let root = getChordRoot(state.degree);

  /*
  |--------------------------------------------------------------------------
  | Apply chord semitone
  |--------------------------------------------------------------------------
  */

  root += chordSemitone;

  /*
  |--------------------------------------------------------------------------
  | Apply transpose
  |--------------------------------------------------------------------------
  */

  root += Math.round(state.transpose);

  /*
  |--------------------------------------------------------------------------
  | Apply octave
  |--------------------------------------------------------------------------
  */

  root += octaveOffset;

  /*
  |--------------------------------------------------------------------------
  | GET INTERVALS
  |--------------------------------------------------------------------------
  */

  let intervals = getChordIntervals(state.quality, state.shape);

  /*
  |--------------------------------------------------------------------------
  | CREATE NOTES
  |--------------------------------------------------------------------------
  */

  let notes = intervals.map((interval) => root + interval);

  /*
  |--------------------------------------------------------------------------
  | INVERSION
  |--------------------------------------------------------------------------
  */

  if (state.shape === "INVERSION") {
    notes = applyInversion(notes);
  }

  /*
  |--------------------------------------------------------------------------
  | SORT
  |--------------------------------------------------------------------------
  */

  notes.sort((a, b) => a - b);

  return notes;
}

/*
|--------------------------------------------------------------------------
| GENERATE NOTE NAMES
|--------------------------------------------------------------------------
|
| This is the function AudioEngine will eventually use.
|
|--------------------------------------------------------------------------
*/

export function generateChordNotes(state: ChordState): string[] {
  const midiNotes = generateChordMidi(state);

  return midiNotes.map(midiToNote);
}

/*
|--------------------------------------------------------------------------
| DEFAULT CHORD
|--------------------------------------------------------------------------
*/

export function createDefaultChordState(): ChordState {
  return {
    degree: "I",

    quality: "MAJOR",

    shape: "ROOT",

    chordSemitone: 0,

    transpose: 0,

    octaveOffset: 0,
  };
}

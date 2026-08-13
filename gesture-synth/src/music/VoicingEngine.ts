import { midiToNote, noteStringToMidi } from "./NoteUtils";

import type { Voicing, OctaveDirection } from "./types";

export class VoicingEngine {
  /**
   * Convert right-hand finger count
   * into the appropriate voicing.
   *
   * 1 → Root position
   * 2 → 1st inversion
   * 3 → 7th chord, root position
   * 4 → 7th chord, root position
   */
  getVoicingFromFingerCount(fingerCount: number): Voicing {
    switch (fingerCount) {
      case 1:
        return "root";

      case 2:
        return "firstInversion";

      case 3:
        return "majorMinor7";

      case 4:
        return "dominantDiminished7";

      default:
        return "root";
    }
  }

  /**
   * Convert the voicing to the actual
   * inversion number.
   *
   * 1 finger → 0
   * 2 fingers → 1
   *
   * 3/4 finger gestures create a
   * seventh chord but remain root position.
   */
  getInversion(voicing: Voicing): number {
    switch (voicing) {
      case "root":
        return 0;

      case "firstInversion":
        return 1;

      case "majorMinor7":
        return 0;

      case "dominantDiminished7":
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Apply an inversion to a chord.
   *
   * Example:
   *
   * C4 E4 G4
   *
   * first inversion:
   *
   * E4 G4 C5
   */
  createInversion(
    notes: string[],
    inversion: number,
    preferFlats = false,
  ): string[] {
    if (notes.length === 0) {
      return [];
    }

    const result = notes.map((note) => noteStringToMidi(note));

    const safeInversion = Math.max(0, Math.min(inversion, notes.length - 1));

    for (let i = 0; i < safeInversion; i++) {
      const first = result.shift();

      if (first === undefined) {
        break;
      }

      result.push(first + 12);
    }

    return result.map((midi) => midiToNote(midi, preferFlats));
  }

  /**
   * Apply octave movement.
   *
   * The thumb controls this only
   * for the normal 1–4 finger gestures.
   */
  applyOctave(
    notes: string[],
    direction: OctaveDirection,
    amount = 1,
    preferFlats = false,
  ): string[] {
    let semitones = 0;

    if (direction === "up") {
      semitones = amount * 12;
    }

    if (direction === "down") {
      semitones = amount * -12;
    }

    if (semitones === 0) {
      return notes;
    }

    return notes.map((note) => {
      const midi = noteStringToMidi(note);

      return midiToNote(midi + semitones, preferFlats);
    });
  }
}

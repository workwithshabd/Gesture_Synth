import { midiToNote, noteStringToMidi, transposeRoot } from "./NoteUtils";

import type { RootNote } from "./types";

export class TransposeEngine {
  /**
   * Transpose a collection of notes.
   */
  transposeNotes(
    notes: string[],
    semitones: number,
    preferFlats = false,
  ): string[] {
    return notes.map((note) => {
      const midi = noteStringToMidi(note);

      return midiToNote(midi + semitones, preferFlats);
    });
  }

  /**
   * Transpose a chord root.
   *
   * This is the important operation
   * for Thumb + Pinky.
   */
  transposeRoot(root: RootNote, semitones: number): RootNote {
    return transposeRoot(root, semitones);
  }
}

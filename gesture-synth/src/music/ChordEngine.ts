import type {
  ChordQuality,
  RootNote,
  ScaleName,
  TriadQuality,
} from "./types";

import {
  getScaleDegreeRoot,
  noteToMidi,
  midiToNote,
  shouldUseFlats,
} from "./NoteUtils";

import {
  SCALE_INTERVALS,
} from "./scales";

export class ChordEngine {
  /**
   * Return the root note represented by
   * a scale degree.
   *
   * Example:
   *
   * G Major
   *
   * 1 → G
   * 2 → A
   * 3 → B
   * 4 → C
   * 5 → D
   * 6 → E
   * 7 → F#
   */
  getScaleDegreeRoot(
    key: RootNote,
    scale: ScaleName,
    degree: number
  ): RootNote {
    const intervals =
      SCALE_INTERVALS[scale];

    if (degree < 1) {
      throw new Error(
        "Scale degree must be at least 1."
      );
    }

    return getScaleDegreeRoot(
      key,
      intervals,
      degree
    );
  }

  /**
   * Convert the left-hand major/minor
   * gesture into a triad quality.
   */
  getTriadQuality(
    quality: TriadQuality
  ): ChordQuality {
    if (quality === "major") {
      return "major";
    }

    return "minor";
  }

  /**
   * Right hand:
   *
   * 1 finger → Root position
   * 2 fingers → 1st inversion
   * 3 fingers → Major/Minor 7th
   * 4 fingers → Dominant/Diminished 7th
   *
   * The base chord quality determines
   * which seventh chord is generated.
   */
  getQualityFromRightHand(
    triadQuality: TriadQuality,
    rightFingerCount: number
  ): ChordQuality {
    switch (rightFingerCount) {
      case 1:
        return triadQuality;

      case 2:
        return triadQuality;

      case 3:
        if (triadQuality === "major") {
          return "major7";
        }

        return "minor7";

      case 4:
        if (triadQuality === "major") {
          return "dominant7";
        }

        return "diminished7";

      default:
        return triadQuality;
    }
  }

  /**
   * Create a chord from an arbitrary root.
   *
   * The user does not directly choose this root.
   *
   * The root comes from:
   *
   * - scale degree
   * - chord transposition
   * - key transposition
   */
  createChord(
    root: RootNote,
    quality: ChordQuality,
    octave = 4
  ): string[] {
    const rootMidi =
      noteToMidi(root, octave);

    let intervals: number[];

    switch (quality) {
      case "major":
        intervals = [0, 4, 7];
        break;

      case "minor":
        intervals = [0, 3, 7];
        break;

      case "diminished":
        intervals = [0, 3, 6];
        break;

      case "major7":
        intervals = [0, 4, 7, 11];
        break;

      case "minor7":
        intervals = [0, 3, 7, 10];
        break;

      case "dominant7":
        intervals = [0, 4, 7, 10];
        break;

      case "diminished7":
        intervals = [0, 3, 6, 9];
        break;

      default:
        intervals = [0, 4, 7];
    }

    const preferFlats =
      shouldUseFlats(root);

    return intervals.map(
      interval =>
        midiToNote(
          rootMidi + interval,
          preferFlats
        )
    );
  }

  /**
   * Create the base chord selected
   * by the left hand.
   *
   * Right-hand finger count then
   * determines the final chord quality.
   */
  createGestureChord(
    key: RootNote,
    scale: ScaleName,
    degree: number,
    leftQuality: TriadQuality,
    rightFingerCount: number,
    octave = 4
  ): {
    root: RootNote;
    quality: ChordQuality;
    notes: string[];
  } {
    const root =
      this.getScaleDegreeRoot(
        key,
        scale,
        degree
      );

    const quality =
      this.getQualityFromRightHand(
        leftQuality,
        rightFingerCount
      );

    const notes =
      this.createChord(
        root,
        quality,
        octave
      );

    return {
      root,
      quality,
      notes,
    };
  }
}
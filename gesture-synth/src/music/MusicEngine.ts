import {
  ChordEngine,
} from "./ChordEngine";

import {
  VoicingEngine,
} from "./VoicingEngine";

import {
  TransposeEngine,
} from "./TransposeEngine";

import type {
  ChordQuality,
  RootNote,
  ScaleName,
  TriadQuality,
  OctaveDirection,
} from "./types";

export interface BuildChordInput {
  key: RootNote;
  scale: ScaleName;

  degree: number;

  leftQuality: TriadQuality;

  rightFingerCount: number;

  octaveDirection: OctaveDirection;

  chordTranspose: number;
}

export interface GeneratedChord {
  originalRoot: RootNote;

  finalRoot: RootNote;

  quality: ChordQuality;

  notes: string[];
}

export interface KeyTransposeResult {
  newKey: RootNote;

  chord: GeneratedChord;
}

export class MusicEngine {
  private chordEngine =
    new ChordEngine();

  private voicingEngine =
    new VoicingEngine();

  private transposeEngine =
    new TransposeEngine();

  /**
   * Build the chord from normal
   * left-hand and right-hand rules.
   */
  buildChord(
    input: BuildChordInput
  ): GeneratedChord {
    const {
      key,
      scale,
      degree,
      leftQuality,
      rightFingerCount,
      octaveDirection,
      chordTranspose,
    } = input;

    /*
     * LEFT HAND:
     *
     * Scale degree → root.
     */
    const originalRoot =
      this.chordEngine.getScaleDegreeRoot(
        key,
        scale,
        degree
      );

    /*
     * RIGHT HAND:
     *
     * Finger count + left-hand quality
     * determine the chord quality.
     */
    const quality =
      this.chordEngine.getQualityFromRightHand(
        leftQuality,
        rightFingerCount
      );

    /*
     * CHORD TRANSPOSE:
     *
     * Normally 0.
     *
     * The special Thumb + Pinky gesture
     * can change this.
     */
    const finalRoot =
      this.transposeEngine.transposeRoot(
        originalRoot,
        chordTranspose
      );

    /*
     * Create the chord.
     */
    let notes =
      this.chordEngine.createChord(
        finalRoot,
        quality,
        4
      );

    /*
     * RIGHT-HAND VOICING.
     */
    const voicing =
      this.voicingEngine
        .getVoicingFromFingerCount(
          rightFingerCount
        );

    const inversion =
      this.voicingEngine.getInversion(
        voicing
      );

    /*
     * Apply inversion.
     */
    notes =
      this.voicingEngine.createInversion(
        notes,
        inversion
      );

    /*
     * Apply octave.
     *
     * Only normal 1–4 finger
     * gestures get octave control.
     */
    if (
      rightFingerCount >= 1 &&
      rightFingerCount <= 4
    ) {
      notes =
        this.voicingEngine.applyOctave(
          notes,
          octaveDirection
        );
    }

    return {
      originalRoot,
      finalRoot,
      quality,
      notes,
    };
  }

  /**
   * Thumb + Pinky
   *
   * Transpose the current chord.
   *
   * Preserve:
   *
   * - chord quality
   * - musical identity
   *
   * The normal right-hand voicing
   * can be reapplied afterward.
   */
  transposeCurrentChord(
    currentChord: GeneratedChord,
    semitones: number
  ): GeneratedChord {
    const newRoot =
      this.transposeEngine.transposeRoot(
        currentChord.finalRoot,
        semitones
      );

    const notes =
      this.chordEngine.createChord(
        newRoot,
        currentChord.quality,
        4
      );

    return {
      originalRoot:
        currentChord.originalRoot,

      finalRoot: newRoot,

      quality:
        currentChord.quality,

      notes,
    };
  }

  /**
   * Thumb + Index + Pinky
   *
   * Transpose the key.
   *
   * The current chord immediately
   * moves to the new key.
   *
   * The result is ALWAYS root position.
   */
  transposeKey(
    currentChord: GeneratedChord,
    currentKey: RootNote,
    semitones: number
  ): KeyTransposeResult {
    const newKey =
      this.transposeEngine.transposeRoot(
        currentKey,
        semitones
      );

    const newChordRoot =
      this.transposeEngine.transposeRoot(
        currentChord.finalRoot,
        semitones
      );

    /*
     * Rebuild the chord from the
     * new root.
     *
     * No inversion is applied.
     */
    const notes =
      this.chordEngine.createChord(
        newChordRoot,
        currentChord.quality,
        4
      );

    return {
      newKey,

      chord: {
        originalRoot:
          currentChord.originalRoot,

        finalRoot:
          newChordRoot,

        quality:
          currentChord.quality,

        notes,
      },
    };
  }
}
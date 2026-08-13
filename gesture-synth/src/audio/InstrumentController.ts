/*
|--------------------------------------------------------------------------
| InstrumentController.ts
|--------------------------------------------------------------------------
|
| Phase 5 — Gesture → Chord → Audio bridge
|
| Responsibilities:
|
|   Gesture/Musical State
|          ↓
|   ChordGenerator
|          ↓
|   AudioEngine
|          ↓
|   Rhodes
|
| This file does NOT detect gestures.
| This file does NOT contain React state.
|
|--------------------------------------------------------------------------
*/

import {
  AudioEngine,
} from "./AudioEngine";

import {
  generateChordNotes,
} from "./ChordGenerator";

import type {
  ChordState,
} from "./ChordGenerator";


export class InstrumentController {

  /*
  |--------------------------------------------------------------------------
  | AUDIO
  |--------------------------------------------------------------------------
  */

  private audio:
    AudioEngine;


  /*
  |--------------------------------------------------------------------------
  | CURRENT NOTES
  |--------------------------------------------------------------------------
  */

  private currentNotes:
    string[] = [];


  /*
  |--------------------------------------------------------------------------
  | CURRENT STATE
  |--------------------------------------------------------------------------
  */

  private currentState:
    ChordState | null = null;


  /*
  |--------------------------------------------------------------------------
  | CONSTRUCTOR
  |--------------------------------------------------------------------------
  */

  constructor(
    audioEngine?: AudioEngine
  ) {

    this.audio =
      audioEngine ??
      new AudioEngine();

  }


  /*
  |--------------------------------------------------------------------------
  | START AUDIO
  |--------------------------------------------------------------------------
  |
  | Must normally be called after a user interaction.
  |
  |--------------------------------------------------------------------------
  */

  async start(): Promise<void> {

    await this.audio.start();

  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE CHORD
  |--------------------------------------------------------------------------
  |
  | Converts musical state into actual notes
  | and sends them to the instrument.
  |
  |--------------------------------------------------------------------------
  */

  playChord(
    state: ChordState
  ): string[] {

    const notes =
      generateChordNotes(
        state
      );


    /*
    |--------------------------------------------------------------------------
    | Avoid unnecessary retriggers
    |--------------------------------------------------------------------------
    */

    if (
      this.notesEqual(
        notes,
        this.currentNotes
      )
    ) {

      return notes;

    }


    /*
    |--------------------------------------------------------------------------
    | Stop previous chord
    |--------------------------------------------------------------------------
    */

    if (
      this.currentNotes.length > 0
    ) {

      this.audio.stop();

    }


    /*
    |--------------------------------------------------------------------------
    | Play new chord
    |--------------------------------------------------------------------------
    */

    this.audio.play(
      notes
    );


    /*
    |--------------------------------------------------------------------------
    | Save state
    |--------------------------------------------------------------------------
    */

    this.currentNotes =
      notes;

    this.currentState =
      {
        ...state,
        chordSemitone:
          this.clampSemitone(
            state.chordSemitone
          ),
      };


    return notes;

  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE WITHOUT PLAYING
  |--------------------------------------------------------------------------
  |
  | Useful when the UI needs to calculate state
  | before the actual gesture is committed.
  |
  |--------------------------------------------------------------------------
  */

  previewChord(
    state: ChordState
  ): string[] {

    return generateChordNotes(
      {
        ...state,

        chordSemitone:
          this.clampSemitone(
            state.chordSemitone
          ),
      }
    );

  }


  /*
  |--------------------------------------------------------------------------
  | STOP
  |--------------------------------------------------------------------------
  */

  stop(): void {

    this.audio.stop();

    this.currentNotes =
      [];

    this.currentState =
      null;

  }


  /*
  |--------------------------------------------------------------------------
  | VOLUME
  |--------------------------------------------------------------------------
  */

  setVolume(
    value: number
  ): void {

    const volume =
      Math.max(
        0,
        Math.min(
          1,
          value
        )
      );


    this.audio.setVolume(
      volume
    );

  }


  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  setFilter(
    frequency: number
  ): void {

    this.audio.setFilter(
      frequency
    );

  }


  /*
  |--------------------------------------------------------------------------
  | GET CURRENT NOTES
  |--------------------------------------------------------------------------
  */

  getCurrentNotes():
    string[] {

    return [
      ...this.currentNotes,
    ];

  }


  /*
  |--------------------------------------------------------------------------
  | GET CURRENT STATE
  |--------------------------------------------------------------------------
  */

  getCurrentState():
    ChordState | null {

    if (
      !this.currentState
    ) {

      return null;

    }


    return {
      ...this.currentState,
    };

  }


  /*
  |--------------------------------------------------------------------------
  | SEMITONE CLAMP
  |--------------------------------------------------------------------------
  |
  | Chord semitone is deliberately limited
  | to exactly:
  |
  | -1
  |  0
  | +1
  |
  |--------------------------------------------------------------------------
  */

  private clampSemitone(
    value: number
  ): number {

    const rounded =
      Math.round(
        value
      );


    return Math.max(
      -1,
      Math.min(
        1,
        rounded
      )
    );

  }


  /*
  |--------------------------------------------------------------------------
  | ARRAY COMPARISON
  |--------------------------------------------------------------------------
  */

  private notesEqual(
    a: string[],
    b: string[]
  ): boolean {

    if (
      a.length !==
      b.length
    ) {

      return false;

    }


    for (
      let i = 0;
      i < a.length;
      i++
    ) {

      if (
        a[i] !== b[i]
      ) {

        return false;

      }

    }


    return true;

  }

}
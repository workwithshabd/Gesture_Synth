/*
|--------------------------------------------------------------------------
| Organ.ts
|--------------------------------------------------------------------------
|
| Tone.js synthesized electric organ.
|
| The organ is intentionally built differently from Rhodes.
|
| Rhodes:
|   - Per-note attack
|   - Tine / bell character
|   - Tremolo
|   - Decaying envelope
|
| Organ:
|   - Multiple continuous harmonics
|   - Fast attack
|   - No natural decay
|   - Sustained tone
|   - Leslie-style modulation
|
|--------------------------------------------------------------------------
*/

import * as Tone from "tone";

import type {
  Instrument,
} from "./Instrument";


export class Organ
  implements Instrument {

  /*
  |--------------------------------------------------------------------------
  | ORGAN VOICES
  |--------------------------------------------------------------------------
  */

  private fundamental:
    Tone.PolySynth;

  private fifth:
    Tone.PolySynth;

  private octave:
    Tone.PolySynth;

  private upper:
    Tone.PolySynth;


  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  private filter:
    Tone.Filter;


  /*
  |--------------------------------------------------------------------------
  | CHORUS
  |--------------------------------------------------------------------------
  */

  private chorus:
    Tone.Chorus;


  /*
  |--------------------------------------------------------------------------
  | VIBRATO
  |--------------------------------------------------------------------------
  */

  private vibrato:
    Tone.Vibrato;


  /*
  |--------------------------------------------------------------------------
  | REVERB
  |--------------------------------------------------------------------------
  */

  private reverb:
    Tone.Reverb;


  /*
  |--------------------------------------------------------------------------
  | ACTIVE NOTES
  |--------------------------------------------------------------------------
  */

  private activeNotes:
    string[] = [];


  /*
  |--------------------------------------------------------------------------
  | CONSTRUCTOR
  |--------------------------------------------------------------------------
  */

  constructor() {

    /*
    |--------------------------------------------------------------------------
    | FILTER
    |--------------------------------------------------------------------------
    */

    this.filter =
      new Tone.Filter({
        type:
          "lowpass",

        frequency:
          5500,

        rolloff:
          -12,

        Q:
          0.5,
      });


    /*
    |--------------------------------------------------------------------------
    | CHORUS
    |--------------------------------------------------------------------------
    */

    this.chorus =
      new Tone.Chorus({
        frequency:
          0.8,

        delayTime:
          3.5,

        depth:
          0.25,

        wet:
          0.28,
      });


    this.chorus.start();


    /*
    |--------------------------------------------------------------------------
    | VIBRATO
    |--------------------------------------------------------------------------
    */

    this.vibrato =
      new Tone.Vibrato({
        frequency:
          5.5,

        depth:
          0.025,

        wet:
          0.15,
      });


    /*
    |--------------------------------------------------------------------------
    | REVERB
    |--------------------------------------------------------------------------
    */

    this.reverb =
      new Tone.Reverb({
        decay:
          2.2,

        wet:
          0.16,
      });


    /*
    |--------------------------------------------------------------------------
    | FUNDAMENTAL
    |--------------------------------------------------------------------------
    */

    this.fundamental =
      new Tone.PolySynth(
        Tone.Synth,
        {
          oscillator: {
            type:
              "sine",
          },

          envelope: {
            attack:
              0.015,

            decay:
              0,

            sustain:
              1,

            release:
              0.15,
          },
        }
      );


    /*
    |--------------------------------------------------------------------------
    | FIFTH
    |--------------------------------------------------------------------------
    |
    | Adds the 3rd harmonic / drawbar-style upper component.
    |
    |--------------------------------------------------------------------------
    */

    this.fifth =
      new Tone.PolySynth(
        Tone.Synth,
        {
          oscillator: {
            type:
              "sine",
          },

          envelope: {
            attack:
              0.015,

            decay:
              0,

            sustain:
              1,

            release:
              0.15,
          },
        }
      );


    /*
    |--------------------------------------------------------------------------
    | OCTAVE
    |--------------------------------------------------------------------------
    */

    this.octave =
      new Tone.PolySynth(
        Tone.Synth,
        {
          oscillator: {
            type:
              "sine",
          },

          envelope: {
            attack:
              0.015,

            decay:
              0,

            sustain:
              1,

            release:
              0.15,
          },
        }
      );


    /*
    |--------------------------------------------------------------------------
    | UPPER HARMONIC
    |--------------------------------------------------------------------------
    */

    this.upper =
      new Tone.PolySynth(
        Tone.Synth,
        {
          oscillator: {
            type:
              "sine",
          },

          envelope: {
            attack:
              0.01,

            decay:
              0,

            sustain:
              1,

            release:
              0.15,
          },
        }
      );


    /*
    |--------------------------------------------------------------------------
    | MIX LEVELS
    |--------------------------------------------------------------------------
    */

    this.fundamental.volume.value =
      -4;

    this.fifth.volume.value =
      -13;

    this.octave.volume.value =
      -10;

    this.upper.volume.value =
      -18;


    /*
    |--------------------------------------------------------------------------
    | AUDIO ROUTING
    |--------------------------------------------------------------------------
    |
    | All drawbar voices
    |          ↓
    |       Filter
    |          ↓
    |       Chorus
    |          ↓
    |       Vibrato
    |          ↓
    |       Reverb
    |          ↓
    |     Destination
    |
    |--------------------------------------------------------------------------
    */

    this.fundamental
      .connect(
        this.filter
      );

    this.fifth
      .connect(
        this.filter
      );

    this.octave
      .connect(
        this.filter
      );

    this.upper
      .connect(
        this.filter
      );

    this.filter
      .connect(
        this.chorus
      )
      .connect(
        this.vibrato
      )
      .connect(
        this.reverb
      )
      .toDestination();

  }


  /*
  |--------------------------------------------------------------------------
  | PLAY
  |--------------------------------------------------------------------------
  */

  play(
    notes: string[]
  ): void {

    if (
      notes.length === 0
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | NORMALIZE
    |--------------------------------------------------------------------------
    */

    const nextNotes =
      Array.from(
        new Set(
          notes
        )
      ).sort();


    /*
    |--------------------------------------------------------------------------
    | CURRENT NOTES
    |--------------------------------------------------------------------------
    */

    const currentNotes =
      this.activeNotes;


    /*
    |--------------------------------------------------------------------------
    | NOTES TO RELEASE
    |--------------------------------------------------------------------------
    */

    const notesToRelease =
      currentNotes.filter(
        note =>
          !nextNotes.includes(
            note
          )
      );


    /*
    |--------------------------------------------------------------------------
    | NOTES TO ATTACK
    |--------------------------------------------------------------------------
    */

    const notesToAttack =
      nextNotes.filter(
        note =>
          !currentNotes.includes(
            note
          )
      );


    /*
    |--------------------------------------------------------------------------
    | NOTHING CHANGED
    |--------------------------------------------------------------------------
    */

    if (
      notesToRelease.length === 0 &&
      notesToAttack.length === 0
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | RELEASE
    |--------------------------------------------------------------------------
    */

    if (
      notesToRelease.length > 0
    ) {

      this.releaseNotes(
        notesToRelease
      );

    }


    /*
    |--------------------------------------------------------------------------
    | ATTACK
    |--------------------------------------------------------------------------
    */

    if (
      notesToAttack.length > 0
    ) {

      this.attackNotes(
        notesToAttack
      );

    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE STATE
    |--------------------------------------------------------------------------
    */

    this.activeNotes =
      nextNotes;

  }


  /*
  |--------------------------------------------------------------------------
  | ATTACK NOTES
  |--------------------------------------------------------------------------
  */

  private attackNotes(
    notes: string[]
  ): void {

    /*
    |--------------------------------------------------------------------------
    | Fundamental
    |--------------------------------------------------------------------------
    */

    this.fundamental
      .triggerAttack(
        notes
      );


    /*
    |--------------------------------------------------------------------------
    | Fifth / 3rd harmonic
    |--------------------------------------------------------------------------
    */

    this.fifth
      .triggerAttack(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(7)
              .toNote()
        )
      );


    /*
    |--------------------------------------------------------------------------
    | Octave
    |--------------------------------------------------------------------------
    */

    this.octave
      .triggerAttack(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(12)
              .toNote()
        )
      );


    /*
    |--------------------------------------------------------------------------
    | Upper harmonic
    |--------------------------------------------------------------------------
    */

    this.upper
      .triggerAttack(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(19)
              .toNote()
        )
      );

  }


  /*
  |--------------------------------------------------------------------------
  | RELEASE NOTES
  |--------------------------------------------------------------------------
  */

  private releaseNotes(
    notes: string[]
  ): void {

    this.fundamental
      .triggerRelease(
        notes
      );


    this.fifth
      .triggerRelease(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(7)
              .toNote()
        )
      );


    this.octave
      .triggerRelease(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(12)
              .toNote()
        )
      );


    this.upper
      .triggerRelease(
        notes.map(
          note =>
            Tone.Frequency(
              note
            )
              .transpose(19)
              .toNote()
        )
      );

  }


  /*
  |--------------------------------------------------------------------------
  | STOP
  |--------------------------------------------------------------------------
  */

  stop(): void {

    if (
      this.activeNotes.length === 0
    ) {

      return;

    }


    this.releaseNotes(
      this.activeNotes
    );


    this.activeNotes =
      [];

  }


  /*
  |--------------------------------------------------------------------------
  | VOLUME
  |--------------------------------------------------------------------------
  */

  setVolume(
    value: number
  ): void {

    const safeValue =
      Math.max(
        0.001,
        Math.min(
          1,
          value
        )
      );


    const db =
      Tone.gainToDb(
        safeValue
      );


    this.fundamental.volume.rampTo(
      db - 4,
      0.05
    );

    this.fifth.volume.rampTo(
      db - 13,
      0.05
    );

    this.octave.volume.rampTo(
      db - 10,
      0.05
    );

    this.upper.volume.rampTo(
      db - 18,
      0.05
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

    const safeFrequency =
      Math.max(
        200,
        Math.min(
          20000,
          frequency
        )
      );


    this.filter.frequency.rampTo(
      safeFrequency,
      0.08
    );

  }


  /*
  |--------------------------------------------------------------------------
  | DISPOSE
  |--------------------------------------------------------------------------
  */

  dispose(): void {

    this.stop();


    /*
    |--------------------------------------------------------------------------
    | Stop modulation
    |--------------------------------------------------------------------------
    */

    this.chorus.stop();


    /*
    |--------------------------------------------------------------------------
    | Dispose synths
    |--------------------------------------------------------------------------
    */

    this.fundamental.dispose();

    this.fifth.dispose();

    this.octave.dispose();

    this.upper.dispose();


    /*
    |--------------------------------------------------------------------------
    | Dispose effects
    |--------------------------------------------------------------------------
    */

    this.filter.dispose();

    this.chorus.dispose();

    this.vibrato.dispose();

    this.reverb.dispose();

  }

}
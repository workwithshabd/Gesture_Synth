import * as Tone from "tone";

import { Organ } from "./Organ";
import { Rhodes } from "./Rhodes";

import type { Instrument } from "./Instrument";

export type InstrumentType = "ORGAN" | "RHODES";

export class AudioEngine {
  private instrument: Instrument;

  private instrumentType: InstrumentType = "ORGAN";

  private volume = 0.3;

  constructor() {
    this.instrument = new Organ();
  }

  async start(): Promise<void> {
    await Tone.start();

    if (Tone.getContext().state !== "running") {
      await Tone.getContext().resume();
    }
  }

  play(notes: string[]): void {
    if (notes.length === 0) {
      return;
    }

    this.instrument.play(notes);
  }

  stop(): void {
    this.instrument.stop();
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));

    this.instrument.setVolume(this.volume);
  }

  setFilter(frequency: number): void {
    this.instrument.setFilter(frequency);
  }

  setInstrument(type: InstrumentType): void {
    if (type === this.instrumentType) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Stop old instrument
    |--------------------------------------------------------------------------
    */

    this.instrument.stop();

    /*
    |--------------------------------------------------------------------------
    | Dispose old Tone nodes
    |--------------------------------------------------------------------------
    */

    this.instrument.dispose();

    /*
    |--------------------------------------------------------------------------
    | Create actual new instrument
    |--------------------------------------------------------------------------
    */

    if (type === "ORGAN") {
      this.instrument = new Organ();
    } else {
      this.instrument = new Rhodes();
    }

    /*
    |--------------------------------------------------------------------------
    | Restore volume
    |--------------------------------------------------------------------------
    */

    this.instrument.setVolume(this.volume);

    this.instrumentType = type;
  }

  getInstrument(): InstrumentType {
    return this.instrumentType;
  }

  dispose(): void {
    this.instrument.dispose();
  }
}

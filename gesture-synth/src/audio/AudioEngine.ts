import * as Tone from "tone";

import { Rhodes } from "./Rhodes";
import type { Instrument } from "./Instrument";

export class AudioEngine {
  private instrument: Instrument;

  constructor() {
    this.instrument = new Rhodes();
  }

  async start(): Promise<void> {
    await Tone.start();
  }

  play(notes: string[]): void {
    this.instrument.play(notes);
  }

  stop(): void {
    this.instrument.stop();
  }

  setVolume(value: number): void {
    this.instrument.setVolume(value);
  }

  setFilter(frequency: number): void {
    this.instrument.setFilter(frequency);
  }
}
export interface Instrument {
  play(notes: string[]): void;
  stop(): void;
  setVolume(value: number): void;
  setFilter(frequency: number): void;
  dispose(): void;
}
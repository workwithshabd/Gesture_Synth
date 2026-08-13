export interface Instrument {
  play(notes: string[]): void;
  stop(): void;

  setVolume(value: number): void;
  setFilter(value: number): void;
}
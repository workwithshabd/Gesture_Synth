import type { ScaleName } from "./types";

export const SCALE_INTERVALS: Record<
  ScaleName,
  number[]
> = {
  major: [
    0, 2, 4, 5, 7, 9, 11
  ],

  naturalMinor: [
    0, 2, 3, 5, 7, 8, 10
  ],

  dorian: [
    0, 2, 3, 5, 7, 9, 10
  ],

  mixolydian: [
    0, 2, 4, 5, 7, 9, 10
  ],

  pentatonic: [
    0, 2, 4, 7, 9
  ],

  blues: [
    0, 3, 5, 6, 7, 10
  ],
};
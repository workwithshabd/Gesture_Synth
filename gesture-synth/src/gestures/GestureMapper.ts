/*
|--------------------------------------------------------------------------
| GestureMapper.ts
|--------------------------------------------------------------------------
*/

import type { TiltDirection } from "./TiltDetector";

import { getTiltDirection } from "./TiltDetector";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export type ChordQuality = "MAJOR" | "MINOR";

export type ChordShape =
  | "ROOT"
  | "INVERSION"
  | "SEVENTH"
  | "DOMINANT_DIMINISHED";

export type Octave = "HIGHER" | "LOWER" | "NORMAL";

export interface FingerState {
  extended: boolean;
  confidence: number;
}

export interface StableFingers {
  count: number;

  thumb: FingerState;

  index: FingerState;

  middle: FingerState;

  ring: FingerState;

  pinky: FingerState;

  landmarks?: {
    x: number;
    y: number;
    z?: number;
  }[];

  handedness?: "Left" | "Right";
}

/*
|--------------------------------------------------------------------------
| LEFT HAND
|--------------------------------------------------------------------------
*/

export interface LeftGesture {
  degree: string;

  quality: ChordQuality;

  tilt: TiltDirection;
}

/*
|--------------------------------------------------------------------------
| LEFT HAND MAPPER
|--------------------------------------------------------------------------
*/

export function mapLeftGesture(
  fingers: StableFingers | null,
): LeftGesture | null {
  if (!fingers) {
    return null;
  }

  const thumb = fingers.thumb.extended;

  const index = fingers.index.extended;

  const middle = fingers.middle.extended;

  const ring = fingers.ring.extended;

  const pinky = fingers.pinky.extended;

  const fingerCount =
    Number(index) + Number(middle) + Number(ring) + Number(pinky);

  const tilt =
    fingers.landmarks && fingers.landmarks.length >= 18
      ? getTiltDirection(fingers.landmarks, fingers.handedness ?? "Left")
      : "NEUTRAL";

  const quality: ChordQuality = tilt === "OUTWARD" ? "MINOR" : "MAJOR";

  let degree: string | null = null;

  if (fingerCount === 1 && index && !middle && !ring && !pinky && !thumb) {
    degree = "I";
  } else if (
    fingerCount === 2 &&
    index &&
    middle &&
    !ring &&
    !pinky &&
    !thumb
  ) {
    degree = "II";
  } else if (fingerCount === 3 && index && middle && ring && !pinky && !thumb) {
    degree = "III";
  } else if (fingerCount === 4 && index && middle && ring && pinky && !thumb) {
    degree = "IV";
  } else if (thumb && fingerCount === 4 && index && middle && ring && pinky) {
    degree = "V";
  } else if (
    fingerCount === 2 &&
    index &&
    pinky &&
    !middle &&
    !ring &&
    !thumb
  ) {
    degree = "VI";
  } else if (thumb && fingerCount === 2 && index && pinky && !middle && !ring) {
    degree = "VII";
  }

  if (!degree) {
    return null;
  }

  return {
    degree,
    quality,
    tilt,
  };
}

/*
|--------------------------------------------------------------------------
| RIGHT HAND
|--------------------------------------------------------------------------
*/

export interface RightGesture {
  shape: ChordShape;

  tilt: TiltDirection;

  semitoneChange: -1 | 0 | 1;
}

/*
|--------------------------------------------------------------------------
| RIGHT HAND MAPPER
|--------------------------------------------------------------------------
|
| SPECIAL GESTURE PRIORITY:
|
| 1. Chord semitone
| 2. Normal chord shape
|
|--------------------------------------------------------------------------
*/

export function mapRightGesture(
  fingers: StableFingers | null,
): RightGesture | null {
  if (!fingers) {
    return null;
  }

  const index = fingers.index.extended;

  const middle = fingers.middle.extended;

  const ring = fingers.ring.extended;

  const pinky = fingers.pinky.extended;

  const nonThumbCount =
    Number(index) + Number(middle) + Number(ring) + Number(pinky);

  const tilt =
    fingers.landmarks && fingers.landmarks.length >= 18
      ? getTiltDirection(fingers.landmarks, fingers.handedness ?? "Right")
      : "NEUTRAL";

  /*
  |--------------------------------------------------------------------------
  | CHORD SEMITONE
  |--------------------------------------------------------------------------
  |
  | Index + Pinky.
  |
  | IMPORTANT:
  |
  | This gesture NEVER changes the key.
  | This gesture NEVER changes transpose.
  |
  |--------------------------------------------------------------------------
  */

  if (isChordSemitoneGesture(fingers)) {
    let semitoneChange: -1 | 0 | 1 = 0;

    if (tilt === "OUTWARD") {
      semitoneChange = 1;
    } else if (tilt === "INWARD") {
      semitoneChange = -1;
    }

    return {
      shape: "ROOT",

      tilt,

      semitoneChange,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | NORMAL RIGHT-HAND SHAPES
  |--------------------------------------------------------------------------
  */

  let shape: ChordShape | null = null;

  if (nonThumbCount === 1) {
    shape = "ROOT";
  } else if (nonThumbCount === 2) {
    shape = "INVERSION";
  } else if (nonThumbCount === 3) {
    shape = "SEVENTH";
  } else if (nonThumbCount === 4) {
    shape = "DOMINANT_DIMINISHED";
  }

  if (!shape) {
    return null;
  }

  return {
    shape,

    tilt,

    semitoneChange: 0,
  };
}

/*
|--------------------------------------------------------------------------
| OCTAVE
|--------------------------------------------------------------------------
|
| Thumb normally controls lower octave.
|
| IMPORTANT:
|
| Thumb-alone transpose gesture is handled separately.
| Therefore octave must NOT activate during transpose.
|
|--------------------------------------------------------------------------
*/

export function mapOctave(fingers: StableFingers | null): Octave {
  if (!fingers) {
    return "NORMAL";
  }

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE HAS PRIORITY
  |--------------------------------------------------------------------------
  */

  if (isTransposeGesture(fingers)) {
    return "NORMAL";
  }

  if (fingers.thumb.extended) {
    return "LOWER";
  }

  return "NORMAL";
}

/*
|--------------------------------------------------------------------------
| TRANSPOSE GESTURE
|--------------------------------------------------------------------------
|
| Thumb alone:
|
| Thumb OPEN
| Index CLOSED
| Middle CLOSED
| Ring CLOSED
| Pinky CLOSED
|
| This is intentionally different from the chord-semitone gesture.
|--------------------------------------------------------------------------
*/

export function isTransposeGesture(fingers: StableFingers | null): boolean {
  if (!fingers) {
    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | CHORD SEMITONE ALWAYS WINS
  |--------------------------------------------------------------------------
  |
  | This prevents a gesture containing an extended thumb from
  | accidentally becoming both semitone and transpose.
  |--------------------------------------------------------------------------
  */

  if (isChordSemitoneGesture(fingers)) {
    return false;
  }

  return (
    fingers.thumb.extended &&
    !fingers.index.extended &&
    !fingers.middle.extended &&
    !fingers.ring.extended &&
    !fingers.pinky.extended
  );
}

/*
|--------------------------------------------------------------------------
| CHORD SEMITONE GESTURE
|--------------------------------------------------------------------------
|
| Index OPEN
| Pinky OPEN
| Middle CLOSED
| Ring CLOSED
|
| Thumb is ignored.
|
|--------------------------------------------------------------------------
*/

export function isChordSemitoneGesture(fingers: StableFingers | null): boolean {
  if (!fingers) {
    return false;
  }

  return (
    fingers.index.extended &&
    fingers.pinky.extended &&
    !fingers.middle.extended &&
    !fingers.ring.extended
  );
}

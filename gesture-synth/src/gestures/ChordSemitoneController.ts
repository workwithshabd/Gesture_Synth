/*
|--------------------------------------------------------------------------
| ChordSemitoneController.ts
|--------------------------------------------------------------------------
|
| Temporary chord semitone controller.
|
| IMPORTANT:
|
| The semitone gesture affects ONLY the currently active chord.
|
| It does NOT:
|
|   - change selectedKey
|   - change transpose
|   - persist after the gesture is released
|
|--------------------------------------------------------------------------
*/

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  FingerState,
} from "./FingerDetector";

import {
  isChordSemitoneGesture,
} from "./GestureMapper";


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export type Semitone =
  | -1
  | 0
  | 1;

export type SemitoneTilt =
  | "INWARD"
  | "NEUTRAL"
  | "OUTWARD";


/*
|--------------------------------------------------------------------------
| STABILITY
|--------------------------------------------------------------------------
*/

const HOLD_TIME_MS = 80;

const SMOOTHING_SAMPLES = 5;


/*
|--------------------------------------------------------------------------
| ANGLE ZONES
|--------------------------------------------------------------------------
*/

const OUTWARD_MAX = 60;

const INWARD_MIN = 120;


/*
|--------------------------------------------------------------------------
| HYSTERESIS
|--------------------------------------------------------------------------
*/

const OUTWARD_TO_NEUTRAL = 65;

const NEUTRAL_TO_OUTWARD = 55;

const NEUTRAL_TO_INWARD = 125;

const INWARD_TO_NEUTRAL = 115;


/*
|--------------------------------------------------------------------------
| PALM ANGLE
|--------------------------------------------------------------------------
*/

function getPalmAngle(
  fingers: FingerState
): number | null {

  const landmarks =
    fingers.landmarks;


  if (
    !landmarks ||
    landmarks.length < 18
  ) {

    return null;

  }


  const indexMcp =
    landmarks[5];

  const pinkyMcp =
    landmarks[17];


  if (
    !indexMcp ||
    !pinkyMcp
  ) {

    return null;

  }


  const dx =
    pinkyMcp.x -
    indexMcp.x;

  const dy =
    pinkyMcp.y -
    indexMcp.y;


  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(dy)
  ) {

    return null;

  }


  let angle =
    Math.atan2(
      dy,
      dx
    ) *
    (180 / Math.PI);


  angle =
    -angle;


  if (
    angle < 0
  ) {

    angle += 360;

  }


  if (
    angle > 180
  ) {

    angle =
      360 - angle;

  }


  return Math.max(
    0,
    Math.min(
      180,
      angle
    )
  );

}


/*
|--------------------------------------------------------------------------
| SMOOTH ANGLE
|--------------------------------------------------------------------------
*/

function getSmoothedAngle(
  samples: number[]
): number {

  if (
    samples.length === 0
  ) {

    return 90;

  }


  const total =
    samples.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );


  return (
    total /
    samples.length
  );

}


/*
|--------------------------------------------------------------------------
| INITIAL ZONE
|--------------------------------------------------------------------------
*/

function getInitialZone(
  angle: number
): SemitoneTilt {

  if (
    angle >= INWARD_MIN
  ) {

    return "INWARD";

  }


  if (
    angle >= OUTWARD_MAX
  ) {

    return "NEUTRAL";

  }


  return "OUTWARD";

}


/*
|--------------------------------------------------------------------------
| HYSTERESIS ZONE
|--------------------------------------------------------------------------
*/

function getNextZone(
  angle: number,
  current: SemitoneTilt
): SemitoneTilt {

  if (
    current === "OUTWARD"
  ) {

    if (
      angle >= OUTWARD_TO_NEUTRAL
    ) {

      return "NEUTRAL";

    }


    return "OUTWARD";

  }


  if (
    current === "NEUTRAL"
  ) {

    if (
      angle <= NEUTRAL_TO_OUTWARD
    ) {

      return "OUTWARD";

    }


    if (
      angle >= NEUTRAL_TO_INWARD
    ) {

      return "INWARD";

    }


    return "NEUTRAL";

  }


  if (
    current === "INWARD"
  ) {

    if (
      angle <= INWARD_TO_NEUTRAL
    ) {

      return "NEUTRAL";

    }


    return "INWARD";

  }


  return getInitialZone(
    angle
  );

}


/*
|--------------------------------------------------------------------------
| ZONE → SEMITONE
|--------------------------------------------------------------------------
*/

function zoneToSemitone(
  zone: SemitoneTilt
): Semitone {

  if (
    zone === "INWARD"
  ) {

    return -1;

  }


  if (
    zone === "OUTWARD"
  ) {

    return 1;

  }


  return 0;

}


/*
|--------------------------------------------------------------------------
| CONTROLLER
|--------------------------------------------------------------------------
*/

export function useChordSemitoneController(
  fingers: FingerState | null
) {

  const [
    chordSemitone,
    setChordSemitone,
  ] =
    useState<Semitone>(
      0
    );


  const [
    semitoneTilt,
    setSemitoneTilt,
  ] =
    useState<SemitoneTilt>(
      "NEUTRAL"
    );


  const angleHistoryRef =
    useRef<number[]>([]);


  const candidateZoneRef =
    useRef<SemitoneTilt | null>(
      null
    );


  const candidateSinceRef =
    useRef<number>(
      0
    );


  const stableZoneRef =
    useRef<SemitoneTilt>(
      "NEUTRAL"
    );


  useEffect(() => {

    /*
    |--------------------------------------------------------------------------
    | NO HAND
    |--------------------------------------------------------------------------
    |
    | Reset the temporary chord semitone.
    |--------------------------------------------------------------------------
    */

    if (
      !fingers
    ) {

      angleHistoryRef.current =
        [];

      candidateZoneRef.current =
        null;

      candidateSinceRef.current =
        0;

      stableZoneRef.current =
        "NEUTRAL";

      setSemitoneTilt(
        "NEUTRAL"
      );

      setChordSemitone(
        0
      );

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | CHECK GESTURE
    |--------------------------------------------------------------------------
    */

    const gestureActive =
      isChordSemitoneGesture(
        fingers
      );


    /*
    |--------------------------------------------------------------------------
    | GESTURE RELEASED
    |--------------------------------------------------------------------------
    |
    | THIS IS THE CRITICAL FIX.
    |
    | The chord semitone goes back to zero.
    |
    | It never becomes part of the permanent key.
    |--------------------------------------------------------------------------
    */

    if (
      !gestureActive
    ) {

      angleHistoryRef.current =
        [];

      candidateZoneRef.current =
        null;

      candidateSinceRef.current =
        0;

      stableZoneRef.current =
        "NEUTRAL";

      setSemitoneTilt(
        "NEUTRAL"
      );

      setChordSemitone(
        previous =>
          previous === 0
            ? previous
            : 0
      );

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | PALM ANGLE
    |--------------------------------------------------------------------------
    */

    const angle =
      getPalmAngle(
        fingers
      );


    if (
      angle === null
    ) {

      return;

    }


    angleHistoryRef.current.push(
      angle
    );


    if (
      angleHistoryRef.current.length >
      SMOOTHING_SAMPLES
    ) {

      angleHistoryRef.current.shift();

    }


    const smoothedAngle =
      getSmoothedAngle(
        angleHistoryRef.current
      );


    const nextZone =
      getNextZone(
        smoothedAngle,
        stableZoneRef.current
      );


    const now =
      performance.now();


    /*
    |--------------------------------------------------------------------------
    | ALREADY STABLE
    |--------------------------------------------------------------------------
    */

    if (
      nextZone ===
      stableZoneRef.current
    ) {

      candidateZoneRef.current =
        null;

      candidateSinceRef.current =
        0;

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | NEW CANDIDATE
    |--------------------------------------------------------------------------
    */

    if (
      candidateZoneRef.current !==
      nextZone
    ) {

      candidateZoneRef.current =
        nextZone;

      candidateSinceRef.current =
        now;

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | HOLD
    |--------------------------------------------------------------------------
    */

    const heldFor =
      now -
      candidateSinceRef.current;


    if (
      heldFor <
      HOLD_TIME_MS
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | ACCEPT
    |--------------------------------------------------------------------------
    */

    stableZoneRef.current =
      nextZone;

    candidateZoneRef.current =
      null;

    candidateSinceRef.current =
      0;


    const nextSemitone =
      zoneToSemitone(
        nextZone
      );


    setSemitoneTilt(
      nextZone
    );


    setChordSemitone(
      nextSemitone
    );

  }, [
    fingers,
  ]);


  /*
  |--------------------------------------------------------------------------
  | RETURN
  |--------------------------------------------------------------------------
  */

  return {

    chordSemitone,

    semitoneTilt,

    setChordSemitone:
      setChordSemitone,

  };

}
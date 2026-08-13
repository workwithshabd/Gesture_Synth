/*
|--------------------------------------------------------------------------
| GestureStabilizer.ts
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


/*
|--------------------------------------------------------------------------
| LOW LATENCY SETTINGS
|--------------------------------------------------------------------------
*/

const HOLD_TIME_MS = 25;
const NULL_GRACE_MS = 40;


/*
|--------------------------------------------------------------------------
| SNAPSHOT
|--------------------------------------------------------------------------
*/

interface FingerSnapshot {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}


/*
|--------------------------------------------------------------------------
| CREATE SNAPSHOT
|--------------------------------------------------------------------------
*/

function createSnapshot(
  fingers: FingerState
): FingerSnapshot {

  return {
    thumb:
      fingers.thumb.extended,

    index:
      fingers.index.extended,

    middle:
      fingers.middle.extended,

    ring:
      fingers.ring.extended,

    pinky:
      fingers.pinky.extended,
  };

}


/*
|--------------------------------------------------------------------------
| COMPARE
|--------------------------------------------------------------------------
*/

function sameSnapshot(
  a: FingerSnapshot | null,
  b: FingerSnapshot | null
): boolean {

  if (
    a === null &&
    b === null
  ) {
    return true;
  }

  if (
    a === null ||
    b === null
  ) {
    return false;
  }

  return (
    a.thumb === b.thumb &&
    a.index === b.index &&
    a.middle === b.middle &&
    a.ring === b.ring &&
    a.pinky === b.pinky
  );

}


/*
|--------------------------------------------------------------------------
| COUNT
|--------------------------------------------------------------------------
*/

function countSnapshot(
  snapshot: FingerSnapshot
): number {

  return (
    Number(snapshot.thumb) +
    Number(snapshot.index) +
    Number(snapshot.middle) +
    Number(snapshot.ring) +
    Number(snapshot.pinky)
  );

}


/*
|--------------------------------------------------------------------------
| SNAPSHOT → FINGER STATE
|--------------------------------------------------------------------------
*/

function toFingerState(
  snapshot: FingerSnapshot,
  landmarks?: FingerState["landmarks"]
): FingerState {

  return {
    thumb: {
      extended: snapshot.thumb,
      confidence: 1,
    },

    index: {
      extended: snapshot.index,
      confidence: 1,
    },

    middle: {
      extended: snapshot.middle,
      confidence: 1,
    },

    ring: {
      extended: snapshot.ring,
      confidence: 1,
    },

    pinky: {
      extended: snapshot.pinky,
      confidence: 1,
    },

    count:
      countSnapshot(snapshot),

    landmarks,
  } as FingerState;

}


/*
|--------------------------------------------------------------------------
| STABILIZER
|--------------------------------------------------------------------------
*/

export function useStableFingers(
  fingers: FingerState | null
): FingerState | null {

  const [
    stableFingers,
    setStableFingers,
  ] =
    useState<FingerState | null>(
      null
    );


  /*
  |--------------------------------------------------------------------------
  | SAME PERSISTENT VARIABLES AS ORIGINAL JS
  |--------------------------------------------------------------------------
  */

  const candidateRef =
    useRef<FingerSnapshot | null>(
      null
    );

  const candidateSinceRef =
    useRef(0);

  const stableRef =
    useRef<FingerSnapshot | null>(
      null
    );

  const lastValidRef =
    useRef(0);


  useEffect(() => {

    const now =
      performance.now();


    /*
    |--------------------------------------------------------------------------
    | NO HAND
    |--------------------------------------------------------------------------
    */

    if (!fingers) {

      if (
        now -
          lastValidRef.current <
        NULL_GRACE_MS
      ) {

        return;

      }


      candidateRef.current =
        null;

      candidateSinceRef.current =
        0;

      stableRef.current =
        null;

      setStableFingers(
        null
      );

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | HAND EXISTS
    |--------------------------------------------------------------------------
    */

    lastValidRef.current =
      now;


    const snapshot =
      createSnapshot(
        fingers
      );


    /*
    |--------------------------------------------------------------------------
    | NEW CANDIDATE
    |--------------------------------------------------------------------------
    */

    if (
      !sameSnapshot(
        snapshot,
        candidateRef.current
      )
    ) {

      candidateRef.current =
        snapshot;

      candidateSinceRef.current =
        now;


      /*
      |--------------------------------------------------------------------------
      | Do not wait for the first state.
      |--------------------------------------------------------------------------
      */

      if (
        stableRef.current ===
        null
      ) {

        stableRef.current =
          snapshot;

        setStableFingers(
          toFingerState(
            snapshot,
            fingers.landmarks
          )
        );

      }

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | HOLD
    |--------------------------------------------------------------------------
    */

    const held =
      now -
      candidateSinceRef.current;


    if (
      held <
      HOLD_TIME_MS
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | ALREADY STABLE
    |--------------------------------------------------------------------------
    */

    if (
      sameSnapshot(
        snapshot,
        stableRef.current
      )
    ) {

      /*
      |--------------------------------------------------------------------------
      | Update landmarks without changing
      | the musical finger state.
      |--------------------------------------------------------------------------
      */

      setStableFingers(
        previous => {

          if (!previous) {
            return toFingerState(
              snapshot,
              fingers.landmarks
            );
          }

          return {
            ...previous,
            landmarks:
              fingers.landmarks,
          };

        }
      );

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | ACCEPT
    |--------------------------------------------------------------------------
    */

    stableRef.current =
      snapshot;


    setStableFingers(
      toFingerState(
        snapshot,
        fingers.landmarks
      )
    );


  }, [
    fingers,
  ]);


  return stableFingers;

}
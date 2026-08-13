/*
|--------------------------------------------------------------------------
| RealtimeGestureEngine.ts
|--------------------------------------------------------------------------
|
| REAL-TIME GESTURE → AUDIO PATH
|
| IMPORTANT:
|
| React is NOT involved in this path.
|
| MediaPipe
|   ↓
| FingerDetector
|   ↓
| RealtimeGestureEngine
|   ↓
| AudioEngine
|
|--------------------------------------------------------------------------
*/

import type {
  HandTrackingResult,
} from "./types";

import {
  detectFingers,
} from "./FingerDetector";

import type {
  FingerState,
} from "./FingerDetector";

import {
  mapLeftGesture,
  mapRightGesture,
  mapOctave,
  isChordSemitoneGesture,
  isTransposeGesture,
} from "./GestureMapper";

import type {
  ChordShape,
} from "./GestureMapper";

import {
  AudioEngine,
} from "../audio/AudioEngine";


/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type ChordQuality =
  | "MAJOR"
  | "MINOR";

type TiltDirection =
  | "INWARD"
  | "OUTWARD"
  | "NEUTRAL";

type Octave =
  | "HIGHER"
  | "LOWER"
  | "NORMAL";


interface FingerSnapshot {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}


interface StableFingerState {
  fingers: FingerState;
  snapshot: FingerSnapshot;
}


/*
|--------------------------------------------------------------------------
| LATENCY SETTINGS
|--------------------------------------------------------------------------
|
| 25ms is short enough to feel immediate while
| still rejecting one-frame noise.
|
|--------------------------------------------------------------------------
*/

const FINGER_HOLD_MS = 25;


/*
|--------------------------------------------------------------------------
| SEMITONE SETTINGS
|--------------------------------------------------------------------------
*/

const SEMITONE_HOLD_MS = 50;

const SEMITONE_SMOOTHING_SAMPLES = 3;


/*
|--------------------------------------------------------------------------
| PALM ANGLE
|--------------------------------------------------------------------------
*/

function getRightPalmAngle(
  landmarks: {
    x: number;
    y: number;
    z?: number;
  }[]
): number | null {

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

  if (
    Math.abs(dx) < 0.0001 &&
    Math.abs(dy) < 0.0001
  ) {
    return null;
  }

  let angle =
    Math.atan2(
      dx,
      -dy
    ) *
    (180 / Math.PI);

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
| RIGHT TILT
|--------------------------------------------------------------------------
*/

function getRightTilt(
  angle: number
): TiltDirection {

  if (
    angle >= 120
  ) {
    return "INWARD";
  }

  if (
    angle >= 60
  ) {
    return "NEUTRAL";
  }

  return "OUTWARD";
}


/*
|--------------------------------------------------------------------------
| LEFT TILT
|--------------------------------------------------------------------------
*/

function getLeftTilt(
  landmarks: {
    x: number;
    y: number;
    z?: number;
  }[]
): TiltDirection {

  if (
    landmarks.length < 18
  ) {
    return "OUTWARD";
  }

  const index =
    landmarks[5];

  const pinky =
    landmarks[17];

  if (
    !index ||
    !pinky
  ) {
    return "OUTWARD";
  }

  const dx =
    pinky.x -
    index.x;

  const dy =
    pinky.y -
    index.y;

  const length =
    Math.hypot(
      dx,
      dy
    );

  if (
    length < 0.001
  ) {
    return "OUTWARD";
  }

  const tilt =
    dy / length;

  return tilt > 0
    ? "INWARD"
    : "OUTWARD";
}


/*
|--------------------------------------------------------------------------
| SNAPSHOT
|--------------------------------------------------------------------------
*/

function snapshot(
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
| SNAPSHOT EQUALITY
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
| REALTIME ENGINE
|--------------------------------------------------------------------------
*/

export class RealtimeGestureEngine {

  private audio: AudioEngine;

  /*
  |--------------------------------------------------------------------------
  | LEFT STABLE STATE
  |--------------------------------------------------------------------------
  */

  private leftStable:
    StableFingerState | null = null;

  private leftCandidate:
    FingerSnapshot | null = null;

  private leftCandidateSince =
    0;


  /*
  |--------------------------------------------------------------------------
  | RIGHT STABLE STATE
  |--------------------------------------------------------------------------
  */

  private rightStable:
    StableFingerState | null = null;

  private rightCandidate:
    FingerSnapshot | null = null;

  private rightCandidateSince =
    0;


  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE
  |--------------------------------------------------------------------------
  */

  private transposeEnabled =
    false;

  private previousTransposeGesture =
    false;


  /*
  |--------------------------------------------------------------------------
  | SEMITONE
  |--------------------------------------------------------------------------
  */

  private chordSemitone:
    -1 | 0 | 1 = 0;

  private semitoneZone:
    TiltDirection =
      "NEUTRAL";

  private semitoneCandidate:
    TiltDirection | null =
      null;

  private semitoneCandidateSince =
    0;

  private angleHistory:
    number[] = [];


  /*
  |--------------------------------------------------------------------------
  | CURRENT AUDIO
  |--------------------------------------------------------------------------
  */

  private previousNotesKey =
    "";


  /*
  |--------------------------------------------------------------------------
  | CONSTRUCTOR
  |--------------------------------------------------------------------------
  */

  constructor(
    audio: AudioEngine
  ) {

    this.audio =
      audio;

  }


  /*
  |--------------------------------------------------------------------------
  | PROCESS
  |--------------------------------------------------------------------------
  |
  | THIS FUNCTION RUNS DIRECTLY FROM THE
  | MEDIAPIPE CALLBACK.
  |
  | NO REACT STATE.
  |
  |--------------------------------------------------------------------------
  */

  process(
    result: HandTrackingResult
  ): void {

    const now =
      performance.now();


    /*
    |--------------------------------------------------------------------------
    | DETECT FINGERS
    |--------------------------------------------------------------------------
    */

    const rawLeft =
      result.leftHand
        ? detectFingers(
            result.leftHand
          )
        : null;

    const rawRight =
      result.rightHand
        ? detectFingers(
            result.rightHand
          )
        : null;


    /*
    |--------------------------------------------------------------------------
    | STABILIZE
    |--------------------------------------------------------------------------
    */

    const left =
      this.updateStableHand(
        rawLeft,
        "left",
        now
      );

    const right =
      this.updateStableHand(
        rawRight,
        "right",
        now
      );


    /*
    |--------------------------------------------------------------------------
    | TRANSPOSE
    |--------------------------------------------------------------------------
    */

    this.updateTranspose(
      right
    );


    /*
    |--------------------------------------------------------------------------
    | SEMITONE
    |--------------------------------------------------------------------------
    */

    this.updateSemitone(
      right,
      now
    );


    /*
    |--------------------------------------------------------------------------
    | GENERATE AUDIO
    |--------------------------------------------------------------------------
    */

    this.updateAudio(
      left,
      right
    );


    /*
    |--------------------------------------------------------------------------
    | VOLUME
    |--------------------------------------------------------------------------
    */

    this.updateVolume(
      result
    );

  }


  /*
  |--------------------------------------------------------------------------
  | STABILIZE HAND
  |--------------------------------------------------------------------------
  */

  private updateStableHand(
    fingers: FingerState | null,
    side: "left" | "right",
    now: number
  ): FingerState | null {

    if (!fingers) {

      if (
        side === "left"
      ) {

        this.leftStable =
          null;

        this.leftCandidate =
          null;

      } else {

        this.rightStable =
          null;

        this.rightCandidate =
          null;

      }

      return null;

    }


    const current =
      snapshot(
        fingers
      );


    const stable =
      side === "left"
        ? this.leftStable
        : this.rightStable;


    const candidate =
      side === "left"
        ? this.leftCandidate
        : this.rightCandidate;


    /*
    |--------------------------------------------------------------------------
    | FIRST STATE
    |--------------------------------------------------------------------------
    */

    if (!stable) {

      const state =
        {
          fingers,
          snapshot: current,
        };

      if (
        side === "left"
      ) {

        this.leftStable =
          state;

        this.leftCandidate =
          current;

      } else {

        this.rightStable =
          state;

        this.rightCandidate =
          current;

      }

      return fingers;

    }


    /*
    |--------------------------------------------------------------------------
    | SAME AS STABLE
    |--------------------------------------------------------------------------
    */

    if (
      sameSnapshot(
        current,
        stable.snapshot
      )
    ) {

      /*
       * Update landmarks continuously.
       * Finger state remains stable.
       */

      stable.fingers =
        fingers;

      if (
        side === "left"
      ) {

        this.leftCandidate =
          null;

      } else {

        this.rightCandidate =
          null;

      }

      return stable.fingers;

    }


    /*
    |--------------------------------------------------------------------------
    | CANDIDATE
    |--------------------------------------------------------------------------
    */

    if (
      !sameSnapshot(
        current,
        candidate
      )
    ) {

      if (
        side === "left"
      ) {

        this.leftCandidate =
          current;

        this.leftCandidateSince =
          now;

      } else {

        this.rightCandidate =
          current;

        this.rightCandidateSince =
          now;

      }

      return stable.fingers;

    }


    /*
    |--------------------------------------------------------------------------
    | HOLD TIME
    |--------------------------------------------------------------------------
    */

    const since =
      side === "left"
        ? this.leftCandidateSince
        : this.rightCandidateSince;

    if (
      now - since <
      FINGER_HOLD_MS
    ) {

      return stable.fingers;

    }


    /*
    |--------------------------------------------------------------------------
    | ACCEPT
    |--------------------------------------------------------------------------
    */

    const nextState =
      {
        fingers,
        snapshot: current,
      };


    if (
      side === "left"
    ) {

      this.leftStable =
        nextState;

      this.leftCandidate =
        null;

    } else {

      this.rightStable =
        nextState;

      this.rightCandidate =
        null;

    }


    return fingers;

  }


  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE
  |--------------------------------------------------------------------------
  */

  private updateTranspose(
    right: FingerState | null
  ): void {

    const active =
      isTransposeGesture(
        right as any
      );


    if (
      active &&
      !this.previousTransposeGesture
    ) {

      this.transposeEnabled =
        !this.transposeEnabled;

    }


    this.previousTransposeGesture =
      active;

  }


  /*
  |--------------------------------------------------------------------------
  | SEMITONE
  |--------------------------------------------------------------------------
  */

  private updateSemitone(
    right: FingerState | null,
    now: number
  ): void {

    if (!right) {
      return;
    }


    const active =
      isChordSemitoneGesture(
        right as any
      );


    if (!active) {

      this.angleHistory =
        [];

      this.semitoneCandidate =
        null;

      this.semitoneCandidateSince =
        0;

      return;

    }


    const angle =
      getRightPalmAngle(
        right.landmarks
      );


    if (
      angle === null
    ) {
      return;
    }


    this.angleHistory.push(
      angle
    );


    if (
      this.angleHistory.length >
      SEMITONE_SMOOTHING_SAMPLES
    ) {

      this.angleHistory.shift();

    }


    const smoothed =
      this.angleHistory.reduce(
        (
          sum,
          value
        ) =>
          sum + value,
        0
      ) /
      this.angleHistory.length;


    const zone =
      getRightTilt(
        smoothed
      );


    /*
    |--------------------------------------------------------------------------
    | SAME ZONE
    |--------------------------------------------------------------------------
    */

    if (
      zone ===
      this.semitoneZone
    ) {

      this.semitoneCandidate =
        null;

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | NEW CANDIDATE
    |--------------------------------------------------------------------------
    */

    if (
      this.semitoneCandidate !==
      zone
    ) {

      this.semitoneCandidate =
        zone;

      this.semitoneCandidateSince =
        now;

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | HOLD
    |--------------------------------------------------------------------------
    */

    if (
      now -
      this.semitoneCandidateSince <
      SEMITONE_HOLD_MS
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | ACCEPT
    |--------------------------------------------------------------------------
    */

    this.semitoneZone =
      zone;

    this.semitoneCandidate =
      null;


    if (
      zone === "INWARD"
    ) {

      this.chordSemitone =
        -1;

    } else if (
      zone === "OUTWARD"
    ) {

      this.chordSemitone =
        1;

    } else {

      this.chordSemitone =
        0;

    }

  }


  /*
  |--------------------------------------------------------------------------
  | AUDIO
  |--------------------------------------------------------------------------
  */

  private updateAudio(
    left: FingerState | null,
    right: FingerState | null
  ): void {

    if (!left) {

      if (
        this.previousNotesKey !== ""
      ) {

        this.audio.stop();

        this.previousNotesKey =
          "";

      }

      return;

    }


    const leftGesture =
      mapLeftGesture(
        left as any
      );


    if (!leftGesture) {

      return;

    }


    const rightGesture =
      mapRightGesture(
        right as any
      );


    const octave =
      mapOctave(
        right as any
      );


    const octaveOffset =
      octave === "HIGHER"
        ? 12
        : octave === "LOWER"
          ? -12
          : 0;


    const transpose =
      this.transposeEnabled
        ? 5
        : 0;


    const notes =
      generateChordNotes({

        degree:
          leftGesture.degree,

        quality:
          this.getLeftQuality(
            left
          ),

        shape:
          rightGesture?.shape ??
          "ROOT",

        chordSemitone:
          this.chordSemitone,

        transpose,

        octaveOffset,

      });


    if (
      notes.length === 0
    ) {

      return;

    }


    const notesKey =
      notes.join("|");


    /*
    |--------------------------------------------------------------------------
    | NOTHING CHANGED
    |--------------------------------------------------------------------------
    */

    if (
      notesKey ===
      this.previousNotesKey
    ) {

      return;

    }


    /*
    |--------------------------------------------------------------------------
    | PLAY IMMEDIATELY
    |--------------------------------------------------------------------------
    */

    this.audio.play(
      notes
    );


    this.previousNotesKey =
      notesKey;

  }


  /*
  |--------------------------------------------------------------------------
  | LEFT QUALITY
  |--------------------------------------------------------------------------
  */

  private getLeftQuality(
    left: FingerState
  ): ChordQuality {

    const tilt =
      getLeftTilt(
        left.landmarks
      );


    return tilt ===
      "INWARD"
      ? "MINOR"
      : "MAJOR";

  }


  /*
  |--------------------------------------------------------------------------
  | VOLUME
  |--------------------------------------------------------------------------
  */

  private updateVolume(
    result: HandTrackingResult
  ): void {

    const landmarks =
      result.rightHand
        ?.landmarks;


    if (
      !landmarks ||
      landmarks.length === 0
    ) {

      return;

    }


    const wrist =
      landmarks[0];


    if (!wrist) {
      return;
    }


    const volume =
      Math.max(
        0,
        Math.min(
          1,
          1 - wrist.y
        )
      );


    this.audio.setVolume(
      volume
    );

  }


  /*
  |--------------------------------------------------------------------------
  | GET STATE FOR UI
  |--------------------------------------------------------------------------
  */

  getState() {

    const left =
      this.leftStable?.fingers ??
      null;

    const right =
      this.rightStable?.fingers ??
      null;


    const leftGesture =
      mapLeftGesture(
        left as any
      );


    const rightGesture =
      mapRightGesture(
        right as any
      );


    const octave =
      mapOctave(
        right as any
      );


    const transpose =
      this.transposeEnabled
        ? 5
        : 0;


    const octaveOffset =
      octave === "HIGHER"
        ? 12
        : octave === "LOWER"
          ? -12
          : 0;


    return {

      left,
      right,

      leftGesture,

      rightGesture,

      octave,

      chordSemitone:
        this.chordSemitone,

      transposeEnabled:
        this.transposeEnabled,

      effectiveTranspose:
        transpose,

      octaveOffset,

      totalOffset:
        this.chordSemitone +
        transpose +
        octaveOffset,

    };

  }


  /*
  |--------------------------------------------------------------------------
  | RESET
  |--------------------------------------------------------------------------
  */

  stop(): void {

    this.audio.stop();

    this.leftStable =
      null;

    this.rightStable =
      null;

    this.leftCandidate =
      null;

    this.rightCandidate =
      null;

    this.previousNotesKey =
      "";

  }

}


/*
|--------------------------------------------------------------------------
| CHORD GENERATION
|--------------------------------------------------------------------------
*/

interface ChordBuildInput {

  degree: string;

  quality: ChordQuality;

  shape: ChordShape;

  chordSemitone: number;

  transpose: number;

  octaveOffset: number;

}


function generateChordNotes(
  input: ChordBuildInput
): string[] {

  const roots:
    Record<string, number> = {

    I: 60,
    II: 62,
    III: 64,
    IV: 65,
    V: 67,
    VI: 69,
    VII: 71,

  };


  let root =
    roots[
      input.degree
    ];


  if (
    root === undefined
  ) {

    return [];

  }


  root +=
    input.chordSemitone;

  root +=
    input.transpose;

  root +=
    input.octaveOffset;


  let intervals:
    number[];


  if (
    input.shape ===
    "ROOT"
  ) {

    intervals =
      input.quality === "MINOR"
        ? [0, 3, 7]
        : [0, 4, 7];

  }

  else if (
    input.shape ===
    "INVERSION"
  ) {

    intervals =
      input.quality === "MINOR"
        ? [3, 7, 12]
        : [4, 7, 12];

  }

  else if (
    input.shape ===
    "SEVENTH"
  ) {

    intervals =
      input.quality === "MINOR"
        ? [0, 3, 7, 10]
        : [0, 4, 7, 11];

  }

  else {

    intervals =
      input.quality === "MINOR"
        ? [0, 3, 6, 9]
        : [0, 4, 7, 10];

  }


  return intervals.map(
    interval =>
      midiToNote(
        root + interval
      )
  );

}


/*
|--------------------------------------------------------------------------
| MIDI → NOTE
|--------------------------------------------------------------------------
*/

function midiToNote(
  midi: number
): string {

  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];


  const safeMidi =
    Math.max(
      0,
      Math.min(
        127,
        Math.round(
          midi
        )
      )
    );


  const note =
    noteNames[
      safeMidi % 12
    ];


  const octave =
    Math.floor(
      safeMidi / 12
    ) - 1;


  return `${note}${octave}`;

}
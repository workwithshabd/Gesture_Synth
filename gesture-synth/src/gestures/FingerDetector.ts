/*
|--------------------------------------------------------------------------
| FingerDetector.ts
|--------------------------------------------------------------------------
*/

import type { HandLandmarks } from "./types";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export interface FingerResult {
  extended: boolean;
  confidence: number;
}

export interface FingerState {
  thumb: FingerResult;
  index: FingerResult;
  middle: FingerResult;
  ring: FingerResult;
  pinky: FingerResult;

  count: number;

  /*
   * Keep the original MediaPipe landmarks.
   * Tilt detection needs these.
   */
  landmarks: HandLandmarks["landmarks"];

  /*
   * Keep track of which hand this is.
   */
  handedness: HandLandmarks["handedness"];
}

type Point = {
  x: number;
  y: number;
  z?: number;
};

/*
|--------------------------------------------------------------------------
| ANGLE
|--------------------------------------------------------------------------
|
| Calculate angle ABC.
|
| Straight finger ≈ 180°
| Folded finger  ≈ smaller angle
|
|--------------------------------------------------------------------------
*/

function angle(a: Point, b: Point, c: Point): number {
  const abx = a.x - b.x;

  const aby = a.y - b.y;

  const cbx = c.x - b.x;

  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;

  const magnitudeAB = Math.hypot(abx, aby);

  const magnitudeCB = Math.hypot(cbx, cby);

  if (magnitudeAB === 0 || magnitudeCB === 0) {
    return 0;
  }

  const cosine = dot / (magnitudeAB * magnitudeCB);

  const clampedCosine = Math.max(-1, Math.min(1, cosine));

  return Math.acos(clampedCosine) * (180 / Math.PI);
}

/*
|--------------------------------------------------------------------------
| DISTANCE
|--------------------------------------------------------------------------
*/

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/*
|--------------------------------------------------------------------------
| HAND SCALE
|--------------------------------------------------------------------------
|
| Wrist → middle MCP
|
| Makes thresholds work at different
| distances from the camera.
|
|--------------------------------------------------------------------------
*/

function getHandScale(hand: HandLandmarks): number {
  const wrist = hand.landmarks[0];

  const middleMcp = hand.landmarks[9];

  if (!wrist || !middleMcp) {
    return 1;
  }

  return Math.max(distance(wrist, middleMcp), 0.0001);
}

/*
|--------------------------------------------------------------------------
| NORMALIZE
|--------------------------------------------------------------------------
|
| Convert value between min/max
| into 0 → 1.
|
|--------------------------------------------------------------------------
*/

function normalize(value: number, min: number, max: number): number {
  if (value <= min) {
    return 0;
  }

  if (value >= max) {
    return 1;
  }

  return (value - min) / (max - min);
}

/*
|--------------------------------------------------------------------------
| DETECT NORMAL FINGER
|--------------------------------------------------------------------------
|
| MCP
| PIP
| DIP
| TIP
|
|--------------------------------------------------------------------------
*/

function detectFinger(
  hand: HandLandmarks,
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number,
): FingerResult {
  const mcp = hand.landmarks[mcpIndex];

  const pip = hand.landmarks[pipIndex];

  const dip = hand.landmarks[dipIndex];

  const tip = hand.landmarks[tipIndex];

  if (!mcp || !pip || !dip || !tip) {
    return {
      extended: false,
      confidence: 0,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | JOINT ANGLES
  |--------------------------------------------------------------------------
  */

  const firstAngle = angle(mcp, pip, dip);

  const secondAngle = angle(pip, dip, tip);

  /*
  |--------------------------------------------------------------------------
  | ANGLE CONFIDENCE
  |--------------------------------------------------------------------------
  |
  | A finger does not need to be mathematically
  | perfectly straight to be considered extended.
  |
  |--------------------------------------------------------------------------
  */

  const firstScore = normalize(firstAngle, 125, 175);

  const secondScore = normalize(secondAngle, 125, 175);

  const confidence = (firstScore + secondScore) / 2;

  /*
  |--------------------------------------------------------------------------
  | EXTENSION DECISION
  |--------------------------------------------------------------------------
  |
  | Previous:
  |
  |   >150 AND >150
  |
  | That was too strict and caused valid
  | five-finger poses to become four fingers.
  |
  |--------------------------------------------------------------------------
  */

  const extended = firstAngle >= 135 && secondAngle >= 140 && confidence >= 0.7;

  return {
    extended,

    confidence,
  };
}

/*
|--------------------------------------------------------------------------
| DETECT THUMB
|--------------------------------------------------------------------------
|
| Thumb is different from the other fingers.
|
| We use:
|
|   thumb MCP
|   thumb IP
|   thumb TIP
|
| plus thumb-tip distance from index MCP.
|
|--------------------------------------------------------------------------
*/
function detectThumb(hand: HandLandmarks): FingerResult {
  const wrist = hand.landmarks[0];

  const thumbCmc = hand.landmarks[1];

  const thumbMcp = hand.landmarks[2];

  const thumbIp = hand.landmarks[3];

  const thumbTip = hand.landmarks[4];

  const indexMcp = hand.landmarks[5];

  if (!wrist || !thumbCmc || !thumbMcp || !thumbIp || !thumbTip || !indexMcp) {
    return {
      extended: false,
      confidence: 0,
    };
  }

  const handScale = getHandScale(hand);

  /*
  |--------------------------------------------------------------------------
  | THUMB MCP ANGLE
  |--------------------------------------------------------------------------
  |
  | Use:
  |
  |   CMC → MCP → IP
  |
  | instead of:
  |
  |   MCP → IP → TIP
  |
  | The MCP angle is a much better indicator
  | of whether the thumb is actually extended.
  |
  |--------------------------------------------------------------------------
  */

  const mcpAngle = angle(thumbCmc, thumbMcp, thumbIp);

  /*
  |--------------------------------------------------------------------------
  | THUMB IP ANGLE
  |--------------------------------------------------------------------------
  |
  | Secondary signal only.
  |
  |--------------------------------------------------------------------------
  */

  const ipAngle = angle(thumbMcp, thumbIp, thumbTip);

  /*
  |--------------------------------------------------------------------------
  | THUMB SPREAD
  |--------------------------------------------------------------------------
  |
  | Distance from thumb tip to index MCP.
  |
  | Open thumb → larger distance
  | Closed thumb → smaller distance
  |
  |--------------------------------------------------------------------------
  */

  const thumbSpread = distance(thumbTip, indexMcp) / handScale;

  /*
  |--------------------------------------------------------------------------
  | ANGLE SCORES
  |--------------------------------------------------------------------------
  */

  const mcpScore = normalize(mcpAngle, 110, 170);

  const ipScore = normalize(ipAngle, 100, 175);

  /*
  |--------------------------------------------------------------------------
  | SPREAD SCORE
  |--------------------------------------------------------------------------
  */

  const spreadScore = normalize(thumbSpread, 0.3, 0.85);

  /*
  |--------------------------------------------------------------------------
  | COMBINED CONFIDENCE
  |--------------------------------------------------------------------------
  |
  | Spread is the strongest signal.
  |
  |--------------------------------------------------------------------------
  */

  const confidence = mcpScore * 0.35 + ipScore * 0.15 + spreadScore * 0.5;

  /*
  |--------------------------------------------------------------------------
  | EXTENSION
  |--------------------------------------------------------------------------
  |
  | We intentionally don't require the thumb
  | to be perfectly straight.
  |
  |--------------------------------------------------------------------------
  */

  const extended = mcpAngle >= 125 && thumbSpread >= 0.38 && confidence >= 0.55;

  return {
    extended,

    confidence,
  };
}

/*
|--------------------------------------------------------------------------
| DETECT ALL FINGERS
|--------------------------------------------------------------------------
*/

export function detectFingers(hand: HandLandmarks): FingerState {
  /*
  |--------------------------------------------------------------------------
  | THUMB
  |--------------------------------------------------------------------------
  */

  const thumb = detectThumb(hand);

  /*
  |--------------------------------------------------------------------------
  | INDEX
  |--------------------------------------------------------------------------
  */

  const index = detectFinger(hand, 5, 6, 7, 8);

  /*
  |--------------------------------------------------------------------------
  | MIDDLE
  |--------------------------------------------------------------------------
  */

  const middle = detectFinger(hand, 9, 10, 11, 12);

  /*
  |--------------------------------------------------------------------------
  | RING
  |--------------------------------------------------------------------------
  */

  const ring = detectFinger(hand, 13, 14, 15, 16);

  /*
  |--------------------------------------------------------------------------
  | PINKY
  |--------------------------------------------------------------------------
  */

  const pinky = detectFinger(hand, 17, 18, 19, 20);

  /*
  |--------------------------------------------------------------------------
  | COUNT
  |--------------------------------------------------------------------------
  */

  const count =
    Number(thumb.extended) +
    Number(index.extended) +
    Number(middle.extended) +
    Number(ring.extended) +
    Number(pinky.extended);

  /*
  |--------------------------------------------------------------------------
  | RETURN
  |--------------------------------------------------------------------------
  |
  | Preserve the original MediaPipe landmarks
  | and handedness.
  |
  |--------------------------------------------------------------------------
  */

  return {
    thumb,

    index,

    middle,

    ring,

    pinky,

    count,

    landmarks: hand.landmarks,

    handedness: hand.handedness,
  };
}

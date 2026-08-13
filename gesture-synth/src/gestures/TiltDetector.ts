/*
|--------------------------------------------------------------------------
| TiltDetector.ts
|--------------------------------------------------------------------------
|
| LEFT HAND
|
|   INWARD  → MINOR
|   OUTWARD → MAJOR
|
| NO NEUTRAL STATE FOR LEFT HAND.
|
|
| RIGHT HAND
|
|   INWARD
|   OUTWARD
|   NEUTRAL
|
| RIGHT HAND NEEDS NEUTRAL because other controls
| use the neutral position.
|
|--------------------------------------------------------------------------
*/

export type TiltDirection =
  | "INWARD"
  | "OUTWARD"
  | "NEUTRAL";

export type Handedness =
  | "Left"
  | "Right";

export interface TiltLandmark {
  x: number;
  y: number;
  z?: number;
}


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

const TILT_THRESHOLD = 0.10;

const INDEX_MCP = 5;

const PINKY_MCP = 17;


/*
|--------------------------------------------------------------------------
| GET TILT VALUE
|--------------------------------------------------------------------------
|
| Returns normalized vertical component of:
|
|   Index MCP → Pinky MCP
|
|--------------------------------------------------------------------------
*/

export function getTiltValue(
  landmarks: TiltLandmark[]
): number {

  if (
    !landmarks ||
    landmarks.length <= PINKY_MCP
  ) {

    return 0;

  }


  const indexMcp =
    landmarks[INDEX_MCP];

  const pinkyMcp =
    landmarks[PINKY_MCP];


  if (
    !indexMcp ||
    !pinkyMcp
  ) {

    return 0;

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

    return 0;

  }


  const length =
    Math.sqrt(
      dx * dx +
      dy * dy
    );


  if (
    length < 0.001
  ) {

    return 0;

  }


  return dy / length;

}


/*
|--------------------------------------------------------------------------
| GET TILT DIRECTION
|--------------------------------------------------------------------------
*/

export function getTiltDirection(
  landmarks: TiltLandmark[],
  handedness?: Handedness
): TiltDirection {

  const tiltValue =
    getTiltValue(
      landmarks
    );


  /*
  |--------------------------------------------------------------------------
  | LEFT HAND
  |--------------------------------------------------------------------------
  |
  | LEFT HAND HAS NO NEUTRAL.
  |
  | Even when the hand is nearly horizontal,
  | force it into one of the two musical states.
  |
  |--------------------------------------------------------------------------
  */

  if (
    handedness === "Left"
  ) {

    if (
      tiltValue > 0
    ) {

      return "INWARD";

    }

    return "OUTWARD";

  }


  /*
  |--------------------------------------------------------------------------
  | RIGHT HAND
  |--------------------------------------------------------------------------
  |
  | RIGHT HAND DOES HAVE NEUTRAL.
  |
  |--------------------------------------------------------------------------
  */

  if (
    handedness === "Right"
  ) {

    if (
      Math.abs(
        tiltValue
      ) < TILT_THRESHOLD
    ) {

      return "NEUTRAL";

    }


    if (
      tiltValue > 0
    ) {

      return "OUTWARD";

    }


    return "INWARD";

  }


  /*
  |--------------------------------------------------------------------------
  | UNKNOWN HAND
  |--------------------------------------------------------------------------
  |
  | Preserve the original neutral behavior.
  |
  |--------------------------------------------------------------------------
  */

  if (
    Math.abs(
      tiltValue
    ) < TILT_THRESHOLD
  ) {

    return "NEUTRAL";

  }


  if (
    tiltValue > 0
  ) {

    return "OUTWARD";

  }


  return "INWARD";

}
/*
|--------------------------------------------------------------------------
| VolumeDetector.ts
|--------------------------------------------------------------------------
|
| Right hand height controls synth volume.
|
| Higher hand  -> louder
| Lower hand   -> softer
|
| MediaPipe Y:
|
| 0 = top of camera
| 1 = bottom of camera
|--------------------------------------------------------------------------
*/

export interface VolumeResult {
  volume: number;
  percentage: number;
}


/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
|
| These define the useful playing area.
|
| Move your hand above 0.15 -> maximum volume
| Move your hand below 0.85 -> minimum volume
|--------------------------------------------------------------------------
*/

const TOP_Y = 0.15;

const BOTTOM_Y = 0.85;


/*
|--------------------------------------------------------------------------
| Clamp
|--------------------------------------------------------------------------
*/

function clamp(
  value: number,
  min: number,
  max: number
): number {

  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}


/*
|--------------------------------------------------------------------------
| Detect volume
|--------------------------------------------------------------------------
*/

export function getHandVolume(
  landmarks:
    | {
        x: number;
        y: number;
        z?: number;
      }[]
    | undefined
): VolumeResult {

  if (
    !landmarks ||
    landmarks.length === 0
  ) {
    return {
      volume: 0.7,
      percentage: 70,
    };
  }


  /*
   * Use wrist + MCP points instead of a single landmark.
   *
   * This makes the measurement much less jittery.
   */

  const importantPoints = [
    landmarks[0],  // wrist
    landmarks[5],  // index MCP
    landmarks[9],  // middle MCP
    landmarks[13], // ring MCP
    landmarks[17], // pinky MCP
  ].filter(Boolean);


  const averageY =
    importantPoints.reduce(
      (
        total,
        point
      ) =>
        total +
        point.y,
      0
    ) /
    importantPoints.length;


  /*
   * Convert:
   *
   * TOP_Y    -> 1
   * BOTTOM_Y -> 0
   */

  const normalized =
    1 -
    (
      averageY -
      TOP_Y
    ) /
    (
      BOTTOM_Y -
      TOP_Y
    );


  const volume =
    clamp(
      normalized,
      0,
      1
    );


  return {
    volume,
    percentage:
      Math.round(
        volume * 100
      ),
  };
}
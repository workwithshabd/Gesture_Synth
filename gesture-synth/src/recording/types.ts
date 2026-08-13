/*
|--------------------------------------------------------------------------
| Recording Types
|--------------------------------------------------------------------------
*/

export type RecordingMode = "SCREEN" | "PERFORMANCE";

export type RecordingState =
  | "IDLE"
  | "STARTING"
  | "RECORDING"
  | "STOPPING"
  | "ERROR";

export interface RecordingOptions {
  mode: RecordingMode;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  mode: RecordingMode;
  duration: number;
}

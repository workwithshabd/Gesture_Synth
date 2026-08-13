export type Handedness = "Left" | "Right";

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  handedness: Handedness;
  landmarks: Landmark[];
}

export interface HandTrackingResult {
  leftHand: HandLandmarks | null;
  rightHand: HandLandmarks | null;
  timestamp: number;
}

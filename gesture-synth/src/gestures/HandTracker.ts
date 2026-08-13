/*
|--------------------------------------------------------------------------
| HandTracker.ts
|--------------------------------------------------------------------------
|
| Low-latency MediaPipe hand tracking.
|
| Responsibilities:
|
|   - Camera frame processing
|   - MediaPipe hand detection
|   - Left / right hand parsing
|   - Tracking-loss information
|   - False-positive hand filtering
|
| IMPORTANT:
|
|   - Never reuse stale landmarks.
|   - Never generate fake landmarks.
|   - Audio / musical state belongs to App.tsx.
|   - Low-confidence / implausible detections are rejected BEFORE
|     they reach FingerDetector.
|
|--------------------------------------------------------------------------
*/

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import type {
  HandLandmarks,
  HandTrackingResult,
  Landmark,
  Handedness,
} from "./types";

/*
|--------------------------------------------------------------------------
| TRACKING LOSS SETTINGS
|--------------------------------------------------------------------------
*/

const MAX_MISSING_FRAMES = 5;

/*
|--------------------------------------------------------------------------
| DETECTION FILTER SETTINGS
|--------------------------------------------------------------------------
|
| These are intentionally stricter than the default MediaPipe values.
|
| The goal is to prevent things such as:
|
|   - face features
|   - hair
|   - background objects
|   - shadows
|   - clothing
|
| from being interpreted as hands.
|
|--------------------------------------------------------------------------
*/

const MIN_HANDEDNESS_CONFIDENCE = 0.7;

const MIN_HAND_LANDMARKS = 21;

/*
|--------------------------------------------------------------------------
| HAND GEOMETRY SETTINGS
|--------------------------------------------------------------------------
|
| These values are deliberately broad.
|
| We do NOT want to reject legitimate hands because of:
|
|   - different hand sizes
|   - camera distance
|   - hand rotation
|   - perspective
|
| We only reject obviously implausible landmark configurations.
|
|--------------------------------------------------------------------------
*/

const MIN_HAND_WIDTH = 0.025;

const MIN_HAND_HEIGHT = 0.035;

const MIN_PALM_LENGTH = 0.025;

const MIN_PALM_WIDTH = 0.015;

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

interface HandLossState {
  missingFrames: number;

  lastDetectedAt: number;
}

/*
|--------------------------------------------------------------------------
| HAND TRACKER
|--------------------------------------------------------------------------
*/

export class HandTracker {
  /*
  |--------------------------------------------------------------------------
  | MEDIAPIPE
  |--------------------------------------------------------------------------
  */

  private handLandmarker: HandLandmarker | null = null;

  /*
  |--------------------------------------------------------------------------
  | VIDEO
  |--------------------------------------------------------------------------
  */

  private video: HTMLVideoElement | null = null;

  /*
  |--------------------------------------------------------------------------
  | CALLBACK
  |--------------------------------------------------------------------------
  */

  private onResults: ((result: HandTrackingResult) => void) | null = null;

  /*
  |--------------------------------------------------------------------------
  | RUNNING
  |--------------------------------------------------------------------------
  */

  private running = false;

  /*
  |--------------------------------------------------------------------------
  | VIDEO FRAME CALLBACK
  |--------------------------------------------------------------------------
  */

  private videoFrameCallbackId: number | null = null;

  /*
  |--------------------------------------------------------------------------
  | RAF FALLBACK
  |--------------------------------------------------------------------------
  */

  private animationFrameId: number | null = null;

  /*
  |--------------------------------------------------------------------------
  | LEFT LOSS
  |--------------------------------------------------------------------------
  */

  private leftLoss: HandLossState = {
    missingFrames: 0,

    lastDetectedAt: 0,
  };

  /*
  |--------------------------------------------------------------------------
  | RIGHT LOSS
  |--------------------------------------------------------------------------
  */

  private rightLoss: HandLossState = {
    missingFrames: 0,

    lastDetectedAt: 0,
  };

  /*
  |--------------------------------------------------------------------------
  | INITIALIZE
  |--------------------------------------------------------------------------
  */

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

        delegate: "GPU",
      },

      runningMode: "VIDEO",

      /*
          |--------------------------------------------------------------------------
          | Maximum number of hands
          |--------------------------------------------------------------------------
          */

      numHands: 2,

      /*
          |--------------------------------------------------------------------------
          | IMPORTANT:
          |
          | These are deliberately higher than 0.5.
          |
          | 0.5 is permissive and can allow weak detections.
          |--------------------------------------------------------------------------
          */

      minHandDetectionConfidence: 0.7,

      minHandPresenceConfidence: 0.65,

      minTrackingConfidence: 0.65,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | START
  |--------------------------------------------------------------------------
  */

  async start(
    video: HTMLVideoElement,

    onResults: (result: HandTrackingResult) => void,
  ): Promise<void> {
    if (!this.handLandmarker) {
      throw new Error("MediaPipe HandLandmarker has not been initialized.");
    }

    this.video = video;

    this.onResults = onResults;

    this.running = true;

    /*
    |--------------------------------------------------------------------------
    | RESET LOSS STATE
    |--------------------------------------------------------------------------
    */

    this.leftLoss = {
      missingFrames: 0,

      lastDetectedAt: 0,
    };

    this.rightLoss = {
      missingFrames: 0,

      lastDetectedAt: 0,
    };

    /*
    |--------------------------------------------------------------------------
    | START FRAME LOOP
    |--------------------------------------------------------------------------
    */

    this.scheduleNextFrame();
  }

  /*
  |--------------------------------------------------------------------------
  | SCHEDULE NEXT FRAME
  |--------------------------------------------------------------------------
  |
  | Prefer requestVideoFrameCallback because it runs when the actual
  | camera/video frame changes.
  |
  | RAF is retained as a fallback.
  |
  |--------------------------------------------------------------------------
  */

  private scheduleNextFrame(): void {
    if (!this.running || !this.video) {
      return;
    }

    const video = this.video;

    if ("requestVideoFrameCallback" in video) {
      this.videoFrameCallbackId = video.requestVideoFrameCallback(
        this.handleVideoFrame,
      );

      return;
    }

    this.animationFrameId = requestAnimationFrame(this.handleAnimationFrame);
  }

  /*
  |--------------------------------------------------------------------------
  | VIDEO FRAME
  |--------------------------------------------------------------------------
  */

  private handleVideoFrame = (
    _now: number,
    metadata: VideoFrameCallbackMetadata,
  ): void => {
    if (!this.running) {
      return;
    }

    this.processFrame(metadata.mediaTime * 1000);
  };

  /*
  |--------------------------------------------------------------------------
  | RAF FALLBACK FRAME
  |--------------------------------------------------------------------------
  */

  private handleAnimationFrame = (now: number): void => {
    if (!this.running) {
      return;
    }

    this.processFrame(now);
  };

  /*
  |--------------------------------------------------------------------------
  | PROCESS FRAME
  |--------------------------------------------------------------------------
  */

  private processFrame(timestamp: number): void {
    if (!this.running || !this.video || !this.handLandmarker) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | MEDIA PIPE TIMESTAMP
    |--------------------------------------------------------------------------
    |
    | MediaPipe VIDEO mode requires monotonically increasing timestamps.
    |--------------------------------------------------------------------------
    */

    const detectionTimestamp = performance.now();

    try {
      const result = this.handLandmarker.detectForVideo(
        this.video,
        detectionTimestamp,
      );

      const trackingResult = this.parseResults(result, timestamp);

      /*
      |--------------------------------------------------------------------------
      | IMMEDIATELY FORWARD RESULT
      |--------------------------------------------------------------------------
      */

      this.onResults?.(trackingResult);
    } catch (error) {
      console.error("MediaPipe detection error:", error);
    }

    /*
    |--------------------------------------------------------------------------
    | NEXT FRAME
    |--------------------------------------------------------------------------
    */

    this.scheduleNextFrame();
  }

  /*
  |--------------------------------------------------------------------------
  | PARSE RESULTS
  |--------------------------------------------------------------------------
  |
  | This is where false positives are removed.
  |
  |--------------------------------------------------------------------------
  */

  private parseResults(
    result: any,

    timestamp: number,
  ): HandTrackingResult {
    let leftHand: HandLandmarks | null = null;

    let rightHand: HandLandmarks | null = null;

    const landmarks = result.landmarks ?? [];

    const handedness = result.handednesses ?? [];

    for (let i = 0; i < landmarks.length; i++) {
      const rawLandmarks = landmarks[i];

      const rawHandedness = handedness[i]?.[0];

      /*
      |--------------------------------------------------------------------------
      | NO HANDEDNESS
      |--------------------------------------------------------------------------
      */

      if (!rawHandedness) {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | HANDEDNESS CONFIDENCE
      |--------------------------------------------------------------------------
      |
      | MediaPipe gives each handedness classification a score.
      |
      | A weak Left/Right classification is not trusted.
      |--------------------------------------------------------------------------
      */

      const handednessScore = Number(rawHandedness.score);

      if (
        !Number.isFinite(handednessScore) ||
        handednessScore < MIN_HANDEDNESS_CONFIDENCE
      ) {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | HANDEDNESS
      |--------------------------------------------------------------------------
      */

      const categoryName = rawHandedness.categoryName as Handedness | undefined;

      if (categoryName !== "Left" && categoryName !== "Right") {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | LANDMARK COUNT
      |--------------------------------------------------------------------------
      */

      if (
        !Array.isArray(rawLandmarks) ||
        rawLandmarks.length < MIN_HAND_LANDMARKS
      ) {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | LANDMARK VALIDITY
      |--------------------------------------------------------------------------
      */

      if (!this.areLandmarksValid(rawLandmarks)) {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | HAND GEOMETRY
      |--------------------------------------------------------------------------
      |
      | Reject detections whose landmark arrangement does not look
      | sufficiently like a human hand.
      |--------------------------------------------------------------------------
      */

      if (!this.isPlausibleHand(rawLandmarks)) {
        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | CONVERT LANDMARKS
      |--------------------------------------------------------------------------
      */

      const converted: Landmark[] = rawLandmarks.map((landmark: any) => ({
        x: landmark.x,

        y: landmark.y,

        z: landmark.z,
      }));

      const hand: HandLandmarks = {
        handedness: categoryName,

        landmarks: converted,
      };

      /*
      |--------------------------------------------------------------------------
      | ASSIGN LEFT
      |--------------------------------------------------------------------------
      */

      if (categoryName === "Left") {
        /*
        |--------------------------------------------------------------------------
        | If MediaPipe somehow returns multiple candidates with the same
        | handedness, keep the first valid one.
        |--------------------------------------------------------------------------
        */

        if (leftHand === null) {
          leftHand = hand;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | ASSIGN RIGHT
      |--------------------------------------------------------------------------
      */

      if (categoryName === "Right") {
        if (rightHand === null) {
          rightHand = hand;
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | TRACKING LOSS
    |--------------------------------------------------------------------------
    */

    this.updateLossState(this.leftLoss, leftHand, timestamp);

    this.updateLossState(this.rightLoss, rightHand, timestamp);

    /*
    |--------------------------------------------------------------------------
    | NEVER RETURN STALE LANDMARKS
    |--------------------------------------------------------------------------
    */

    return {
      leftHand,

      rightHand,

      timestamp,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | LANDMARK VALIDATION
  |--------------------------------------------------------------------------
  |
  | Makes sure MediaPipe returned actual usable normalized coordinates.
  |--------------------------------------------------------------------------
  */

  private areLandmarksValid(landmarks: any[]): boolean {
    for (const landmark of landmarks) {
      if (!landmark) {
        return false;
      }

      const x = Number(landmark.x);

      const y = Number(landmark.y);

      const z = Number(landmark.z);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return false;
      }

      /*
      |--------------------------------------------------------------------------
      | MediaPipe normalized coordinates can occasionally go slightly outside
      | 0..1 because of tracking/perspective. Allow a small margin.
      |--------------------------------------------------------------------------
      */

      if (x < -0.25 || x > 1.25 || y < -0.25 || y > 1.25) {
        return false;
      }

      /*
      |--------------------------------------------------------------------------
      | z is optional in our own type, but if MediaPipe supplies it and it
      | is invalid, reject the detection.
      |--------------------------------------------------------------------------
      */

      if (!Number.isFinite(z)) {
        /*
        |--------------------------------------------------------------------------
        | Some MediaPipe/browser combinations can omit z.
        |
        | Do not reject solely because z is absent.
        |--------------------------------------------------------------------------
        */

        if (landmark.z !== undefined && landmark.z !== null) {
          return false;
        }
      }
    }

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | PLAUSIBLE HAND
  |--------------------------------------------------------------------------
  |
  | A real hand has a recognizable geometric structure:
  |
  |   wrist
  |      |
  |      |
  |   MCP row
  |   / / / \
  |  fingers
  |
  | A face/background false positive tends to produce a much less
  | hand-like arrangement.
  |--------------------------------------------------------------------------
  */

  private isPlausibleHand(landmarks: any[]): boolean {
    if (landmarks.length < MIN_HAND_LANDMARKS) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | REQUIRED HAND LANDMARKS
    |--------------------------------------------------------------------------
    */

    const wrist = landmarks[0];

    const indexMcp = landmarks[5];

    const middleMcp = landmarks[9];

    const ringMcp = landmarks[13];

    const pinkyMcp = landmarks[17];

    if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | BOUNDING BOX
    |--------------------------------------------------------------------------
    */

    let minX = Infinity;

    let maxX = -Infinity;

    let minY = Infinity;

    let maxY = -Infinity;

    for (const landmark of landmarks) {
      minX = Math.min(minX, landmark.x);

      maxX = Math.max(maxX, landmark.x);

      minY = Math.min(minY, landmark.y);

      maxY = Math.max(maxY, landmark.y);
    }

    const width = maxX - minX;

    const height = maxY - minY;

    /*
    |--------------------------------------------------------------------------
    | TOO SMALL
    |--------------------------------------------------------------------------
    |
    | A tiny false detection in the background is not treated as a hand.
    |--------------------------------------------------------------------------
    */

    if (width < MIN_HAND_WIDTH) {
      return false;
    }

    if (height < MIN_HAND_HEIGHT) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | PALM LENGTH
    |--------------------------------------------------------------------------
    */

    const palmLength = this.distance(wrist, middleMcp);

    if (palmLength < MIN_PALM_LENGTH) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | PALM WIDTH
    |--------------------------------------------------------------------------
    */

    const palmWidth = this.distance(indexMcp, pinkyMcp);

    if (palmWidth < MIN_PALM_WIDTH) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | MCP ORDER / PALM STRUCTURE
    |--------------------------------------------------------------------------
    |
    | The four MCP joints should occupy a meaningful span across the palm.
    |
    |--------------------------------------------------------------------------
    */

    const indexToPinky = this.distance(indexMcp, pinkyMcp);

    const middleToRing = this.distance(middleMcp, ringMcp);

    if (indexToPinky < middleToRing * 0.65) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | FINGER ROOT SPREAD
    |--------------------------------------------------------------------------
    |
    | Prevent pathological predictions where all MCP landmarks collapse
    | into almost the same location.
    |--------------------------------------------------------------------------
    */

    const indexToMiddle = this.distance(indexMcp, middleMcp);

    const ringToPinky = this.distance(ringMcp, pinkyMcp);

    if (indexToMiddle < 0.005 && ringToPinky < 0.005) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | PALM RATIO
    |--------------------------------------------------------------------------
    |
    | A hand's palm width and palm length should be in a reasonable range.
    |--------------------------------------------------------------------------
    */

    const palmRatio = palmWidth / palmLength;

    if (palmRatio < 0.15 || palmRatio > 3.5) {
      return false;
    }

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | DISTANCE
  |--------------------------------------------------------------------------
  */

  private distance(
    a: {
      x: number;
      y: number;
    },

    b: {
      x: number;
      y: number;
    },
  ): number {
    const dx = a.x - b.x;

    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE LOSS STATE
  |--------------------------------------------------------------------------
  */

  private updateLossState(
    state: HandLossState,

    hand: HandLandmarks | null,

    timestamp: number,
  ): void {
    if (hand) {
      state.missingFrames = 0;

      state.lastDetectedAt = timestamp;

      return;
    }

    state.missingFrames = Math.min(state.missingFrames + 1, MAX_MISSING_FRAMES);
  }

  /*
  |--------------------------------------------------------------------------
  | STOP
  |--------------------------------------------------------------------------
  */

  stop(): void {
    this.running = false;

    /*
    |--------------------------------------------------------------------------
    | CANCEL VIDEO CALLBACK
    |--------------------------------------------------------------------------
    */

    if (
      this.video &&
      this.videoFrameCallbackId !== null &&
      "cancelVideoFrameCallback" in this.video
    ) {
      this.video.cancelVideoFrameCallback(this.videoFrameCallbackId);
    }

    this.videoFrameCallbackId = null;

    /*
    |--------------------------------------------------------------------------
    | CANCEL RAF
    |--------------------------------------------------------------------------
    */

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = null;

    /*
    |--------------------------------------------------------------------------
    | CLEAR REFERENCES
    |--------------------------------------------------------------------------
    */

    this.video = null;

    this.onResults = null;

    /*
    |--------------------------------------------------------------------------
    | RESET LOSS
    |--------------------------------------------------------------------------
    */

    this.leftLoss = {
      missingFrames: 0,

      lastDetectedAt: 0,
    };

    this.rightLoss = {
      missingFrames: 0,

      lastDetectedAt: 0,
    };
  }
}

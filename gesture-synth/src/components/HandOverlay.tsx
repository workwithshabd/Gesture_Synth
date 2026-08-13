import { useEffect, useRef } from "react";

import type { HandLandmarks } from "../gestures/types";

/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

interface HandOverlayProps {
  video: HTMLVideoElement | null;

  leftHand: HandLandmarks | null;

  rightHand: HandLandmarks | null;
}

/*
|--------------------------------------------------------------------------
| HAND OVERLAY
|--------------------------------------------------------------------------
|
| Draws ONLY landmark dots.
|
| No bones.
| No connecting lines.
|
|--------------------------------------------------------------------------
*/

export function HandOverlay({ video, leftHand, rightHand }: HandOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !video) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    let animationFrameId: number;

    /*
    |--------------------------------------------------------------------------
    | DRAW LOOP
    |--------------------------------------------------------------------------
    */

    const draw = () => {
      /*
      |--------------------------------------------------------------------------
      | WAIT FOR VIDEO
      |--------------------------------------------------------------------------
      */

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationFrameId = requestAnimationFrame(draw);

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | VIDEO DIMENSIONS
      |--------------------------------------------------------------------------
      */

      const width = video.videoWidth;

      const height = video.videoHeight;

      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(draw);

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | MATCH CANVAS TO VIDEO
      |--------------------------------------------------------------------------
      */

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;

        canvas.height = height;
      }

      /*
      |--------------------------------------------------------------------------
      | CLEAR
      |--------------------------------------------------------------------------
      */

      ctx.clearRect(0, 0, width, height);

      /*
      |--------------------------------------------------------------------------
      | DRAW HANDS
      |--------------------------------------------------------------------------
      */

      drawHand(ctx, leftHand, width, height);

      drawHand(ctx, rightHand, width, height);

      /*
      |--------------------------------------------------------------------------
      | NEXT FRAME
      |--------------------------------------------------------------------------
      */

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [video, leftHand, rightHand]);

  /*
  |--------------------------------------------------------------------------
  | CANVAS
  |--------------------------------------------------------------------------
  */

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",

        inset: 0,

        width: "100%",

        height: "100%",

        pointerEvents: "none",

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT
        |--------------------------------------------------------------------------
        |
        | CameraView mirrors the video with
        | scaleX(-1), so the overlay must also
        | be mirrored.
        |
        |--------------------------------------------------------------------------
        */

        transform: "scaleX(-1)",
      }}
    />
  );
}

/*
|--------------------------------------------------------------------------
| DRAW HAND
|--------------------------------------------------------------------------
|
| Draws 21 MediaPipe landmarks as dots.
|
|--------------------------------------------------------------------------
*/

function drawHand(
  ctx: CanvasRenderingContext2D,

  hand: HandLandmarks | null,

  width: number,

  height: number,
) {
  if (!hand) {
    return;
  }

  const landmarks = hand.landmarks;

  if (!landmarks || landmarks.length === 0) {
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | DRAW LANDMARKS
  |--------------------------------------------------------------------------
  */

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];

    if (!landmark) {
      continue;
    }

    const x = landmark.x * width;

    const y = landmark.y * height;

    /*
    |--------------------------------------------------------------------------
    | DOT SIZE
    |--------------------------------------------------------------------------
    |
    | Wrist:
    |   slightly larger
    |
    | Finger tips:
    |   larger
    |
    | Other joints:
    |   normal
    |
    |--------------------------------------------------------------------------
    */

    const isWrist = i === 0;

    const isFingerTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;

    const radius = isWrist ? 8 : isFingerTip ? 7 : 5;

    /*
    |--------------------------------------------------------------------------
    | OUTER DOT
    |--------------------------------------------------------------------------
    |
    | Dark outline makes the dots visible
    | against both the hand and background.
    |
    |--------------------------------------------------------------------------
    */

    ctx.beginPath();

    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";

    ctx.fill();

    /*
    |--------------------------------------------------------------------------
    | MAIN DOT
    |--------------------------------------------------------------------------
    */

    ctx.beginPath();

    ctx.arc(x, y, radius, 0, Math.PI * 2);

    /*
    |--------------------------------------------------------------------------
    | DOT COLOR
    |--------------------------------------------------------------------------
    */

    ctx.fillStyle = isWrist ? "#FFD700" : isFingerTip ? "#00FFFF" : "#FFFFFF";

    ctx.fill();

    /*
    |--------------------------------------------------------------------------
    | SMALL CENTER HIGHLIGHT
    |--------------------------------------------------------------------------
    */

    ctx.beginPath();

    ctx.arc(
      x - radius * 0.25,
      y - radius * 0.25,
      Math.max(1, radius * 0.2),
      0,
      Math.PI * 2,
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

    ctx.fill();
  }
}

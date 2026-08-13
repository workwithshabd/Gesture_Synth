/*
|--------------------------------------------------------------------------
| CameraView.tsx
|--------------------------------------------------------------------------
*/

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  HandTracker,
} from "../gestures/HandTracker";

import type {
  HandTrackingResult,
} from "../gestures/types";

import {
  HandOverlay,
} from "./HandOverlay";


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

interface CameraViewProps {

  onResults?: (
    result: HandTrackingResult
  ) => void;

  trackingResult:
    HandTrackingResult;
}


/*
|--------------------------------------------------------------------------
| CAMERA VIEW
|--------------------------------------------------------------------------
*/

export function CameraView({
  onResults,
  trackingResult,
}: CameraViewProps) {

  /*
  |--------------------------------------------------------------------------
  | VIDEO
  |--------------------------------------------------------------------------
  */

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );


  /*
  |--------------------------------------------------------------------------
  | TRACKER
  |--------------------------------------------------------------------------
  */

  const trackerRef =
    useRef<HandTracker | null>(
      null
    );


  /*
  |--------------------------------------------------------------------------
  | ON RESULTS REF
  |--------------------------------------------------------------------------
  |
  | Keep the latest callback without
  | restarting camera / MediaPipe.
  |
  |--------------------------------------------------------------------------
  */

  const onResultsRef =
    useRef<
      ((
        result: HandTrackingResult
      ) => void) | undefined
    >(onResults);


  /*
  |--------------------------------------------------------------------------
  | KEEP CALLBACK CURRENT
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    onResultsRef.current =
      onResults;

  }, [
    onResults,
  ]);


  /*
  |--------------------------------------------------------------------------
  | VIDEO ELEMENT STATE
  |--------------------------------------------------------------------------
  |
  | Used by HandOverlay.
  |
  |--------------------------------------------------------------------------
  */

  const [
    videoElement,
    setVideoElement,
  ] =
    useState<HTMLVideoElement | null>(
      null
    );


  /*
  |--------------------------------------------------------------------------
  | ERROR
  |--------------------------------------------------------------------------
  */

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  /*
  |--------------------------------------------------------------------------
  | INITIALIZE CAMERA + TRACKER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    let mounted =
      true;

    let stream:
      | MediaStream
      | null =
      null;


    async function initialize() {

      try {

        /*
        |--------------------------------------------------------------------------
        | RESET ERROR
        |--------------------------------------------------------------------------
        */

        setError(null);


        /*
        |--------------------------------------------------------------------------
        | CHECK CAMERA API
        |--------------------------------------------------------------------------
        */

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {

          throw new Error(
            "Camera API is unavailable."
          );

        }


        /*
        |--------------------------------------------------------------------------
        | REQUEST CAMERA
        |--------------------------------------------------------------------------
        */

        stream =
          await navigator.mediaDevices
            .getUserMedia({

              video: {

                width: {
                  ideal: 1280,
                },

                height: {
                  ideal: 720,
                },

                facingMode:
                  "user",

              },

              audio:
                false,

            });


        /*
        |--------------------------------------------------------------------------
        | COMPONENT UNMOUNTED
        |--------------------------------------------------------------------------
        */

        if (!mounted) {

          stream
            .getTracks()
            .forEach(
              track =>
                track.stop()
            );

          return;

        }


        /*
        |--------------------------------------------------------------------------
        | VIDEO ELEMENT
        |--------------------------------------------------------------------------
        */

        const video =
          videoRef.current;


        if (!video) {

          throw new Error(
            "Video element was not created."
          );

        }


        /*
        |--------------------------------------------------------------------------
        | CONNECT STREAM
        |--------------------------------------------------------------------------
        */

        video.srcObject =
          stream;


        /*
        |--------------------------------------------------------------------------
        | START VIDEO
        |--------------------------------------------------------------------------
        */

        await video.play();


        /*
        |--------------------------------------------------------------------------
        | SAVE VIDEO ELEMENT
        |--------------------------------------------------------------------------
        */

        if (!mounted) {

          return;

        }


        setVideoElement(
          video
        );


        /*
        |--------------------------------------------------------------------------
        | CREATE TRACKER
        |--------------------------------------------------------------------------
        */

        const tracker =
          new HandTracker();


        trackerRef.current =
          tracker;


        /*
        |--------------------------------------------------------------------------
        | INITIALIZE MEDIAPIPE
        |--------------------------------------------------------------------------
        */

        await tracker.initialize();


        /*
        |--------------------------------------------------------------------------
        | CHECK MOUNT
        |--------------------------------------------------------------------------
        */

        if (!mounted) {

          tracker.stop();

          return;

        }


        /*
        |--------------------------------------------------------------------------
        | START TRACKING
        |--------------------------------------------------------------------------
        */

        await tracker.start(
          video,
          result => {

            if (!mounted) {

              return;

            }


            /*
            |--------------------------------------------------------------------------
            | FORWARD TRACKING RESULT
            |--------------------------------------------------------------------------
            */

            onResultsRef.current?.(
              result
            );

          }
        );

      } catch (err) {

        console.error(
          "Gesture Synth camera error:",
          err
        );


        if (!mounted) {

          return;

        }


        const message =
          err instanceof Error
            ? err.message
            : String(err);


        setError(
          message
        );

      }

    }


    /*
    |--------------------------------------------------------------------------
    | START
    |--------------------------------------------------------------------------
    */

    initialize();


    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */

    return () => {

      mounted =
        false;


      /*
      |--------------------------------------------------------------------------
      | STOP TRACKER
      |--------------------------------------------------------------------------
      */

      trackerRef.current?.stop();

      trackerRef.current =
        null;


      /*
      |--------------------------------------------------------------------------
      | STOP CAMERA
      |--------------------------------------------------------------------------
      */

      const video =
        videoRef.current;


      if (video) {

        const currentStream =
          video.srcObject as
            | MediaStream
            | null;


        currentStream
          ?.getTracks()
          .forEach(
            track =>
              track.stop()
          );


        video.pause();

        video.srcObject =
          null;

      }


      /*
      |--------------------------------------------------------------------------
      | FALLBACK STREAM CLEANUP
      |--------------------------------------------------------------------------
      */

      stream
        ?.getTracks()
        .forEach(
          track =>
            track.stop()
        );

    };

  }, []);


  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (

    <div
      style={{
        position:
          "absolute",

        inset:
          0,

        width:
          "100%",

        height:
          "100%",

        margin:
          0,

        padding:
          0,

        overflow:
          "hidden",

        background:
          "#000",
      }}
    >

      <video
        ref={
          videoRef
        }

        autoPlay

        muted

        playsInline

        style={{
          position:
            "absolute",

          inset:
            0,

          width:
            "100%",

          height:
            "100%",

          objectFit:
            "cover",

          objectPosition:
            "center",

          transform:
            "scaleX(-1)",

          display:
            "block",
        }}
      />


      <HandOverlay
        video={
          videoElement
        }

        leftHand={
          trackingResult.leftHand
        }

        rightHand={
          trackingResult.rightHand
        }
      />


      {error && (

        <div
          style={{
            position:
              "absolute",

            left:
              "20px",

            right:
              "20px",

            bottom:
              "20px",

            zIndex:
              20,

            padding:
              "12px 16px",

            borderRadius:
              "10px",

            background:
              "rgba(80,0,0,0.85)",

            color:
              "#ffaaaa",

            fontSize:
              "13px",

            lineHeight:
              1.4,

            pointerEvents:
              "none",

            backdropFilter:
              "blur(12px)",

            WebkitBackdropFilter:
              "blur(12px)",
          }}
        >
          {error}
        </div>

      )}

    </div>

  );

}
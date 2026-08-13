/*
|--------------------------------------------------------------------------
| App.tsx
|--------------------------------------------------------------------------
|
| Gesture Synth
|
| TRANSPOSE BEHAVIOUR
|
|   Transpose selector:
|       chooses the transpose amount
|
|   Transpose gesture:
|       acts ONLY as an ON / OFF switch
|
| Example:
|
|   KEY        = C
|   TRANSPOSE  = +3
|
|   OFF → C
|   ON  → D#
|   OFF → C
|   ON  → D#
|
|--------------------------------------------------------------------------
*/

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CameraView,
} from "./components/CameraView";

import type {
  HandTrackingResult,
} from "./gestures/types";

import {
  detectFingers,
} from "./gestures/FingerDetector";

import {
  useStableFingers,
} from "./gestures/GestureStabilizer";

import {
  mapLeftGesture,
  mapRightGesture,
  mapOctave,
  isChordSemitoneGesture,
  isTransposeGesture,
} from "./gestures/GestureMapper";

import {
  useChordSemitoneController,
} from "./gestures/ChordSemitoneController";

import {
  getTiltDirection,
} from "./gestures/TiltDetector";

import {
  AudioEngine,
} from "./audio/AudioEngine";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type LeftTiltDirection =
  | "INWARD"
  | "OUTWARD";

type RightTiltDirection =
  | "INWARD"
  | "OUTWARD"
  | "NEUTRAL";

type ChordQuality =
  | "MAJOR"
  | "MINOR";

type ChordShape =
  | "ROOT"
  | "INVERSION"
  | "SEVENTH"
  | "DOMINANT_DIMINISHED";

/*
|--------------------------------------------------------------------------
| RIGHT PALM ANGLE
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
| RIGHT ANGLE → TILT
|--------------------------------------------------------------------------
*/

function getRightTiltFromAngle(
  angle: number
): RightTiltDirection {

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
| KEY MAP
|--------------------------------------------------------------------------
*/

const KEY_OFFSETS:
  Record<string, number> = {

  C:
    0,

  "C#":
    1,

  D:
    2,

  "D#":
    3,

  E:
    4,

  F:
    5,

  "F#":
    6,

  G:
    7,

  "G#":
    8,

  A:
    9,

  "A#":
    10,

  B:
    11,

};

/*
|--------------------------------------------------------------------------
| KEY NAMES
|--------------------------------------------------------------------------
*/

const KEY_NAMES = [

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

/*
|--------------------------------------------------------------------------
| SCALE MAP
|--------------------------------------------------------------------------
*/

const SCALE_INTERVALS:
  Record<string, Record<string, number>> = {

  MAJOR: {

    I:
      0,

    II:
      2,

    III:
      4,

    IV:
      5,

    V:
      7,

    VI:
      9,

    VII:
      11,

  },

  MINOR: {

    I:
      0,

    II:
      2,

    III:
      3,

    IV:
      5,

    V:
      7,

    VI:
      8,

    VII:
      10,

  },

};

/*
|--------------------------------------------------------------------------
| DEFAULT VOLUME
|--------------------------------------------------------------------------
*/

const DEFAULT_VOLUME =
  0.30;

/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

function App() {

  /*
  |--------------------------------------------------------------------------
  | AUDIO ENGINE
  |--------------------------------------------------------------------------
  */

  const audioRef =
    useRef<AudioEngine | null>(
      null
    );

  if (
    !audioRef.current
  ) {

    audioRef.current =
      new AudioEngine();

  }

  /*
  |--------------------------------------------------------------------------
  | AUDIO STARTED
  |--------------------------------------------------------------------------
  */

  const [
    audioStarted,
    setAudioStarted,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | UI STATE
  |--------------------------------------------------------------------------
  */

  const [
    selectedKey,
    setSelectedKey,
  ] =
    useState("C");

  const [
    selectedScale,
    setSelectedScale,
  ] =
    useState("MAJOR");

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE AMOUNT
  |--------------------------------------------------------------------------
  */

  const [
    transposeSemitones,
    setTransposeSemitones,
  ] =
    useState(0);

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE SWITCH
  |--------------------------------------------------------------------------
  */

  const [
    transposeEnabled,
    setTransposeEnabled,
  ] =
    useState(false);

  const [
    guideOpen,
    setGuideOpen,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | EFFECTIVE TRANSPOSE
  |--------------------------------------------------------------------------
  */

  const effectiveTranspose =
    transposeEnabled
      ? transposeSemitones
      : 0;

  /*
  |--------------------------------------------------------------------------
  | EFFECTIVE DISPLAY KEY
  |--------------------------------------------------------------------------
  */

  const effectiveKey =
    useMemo(() => {

      const baseOffset =
        KEY_OFFSETS[
          selectedKey
        ];

      if (
        baseOffset === undefined
      ) {

        return selectedKey;

      }

      const rawOffset =
        baseOffset +
        effectiveTranspose;

      const normalizedOffset =
        (
          (
            rawOffset %
            12
          ) +
          12
        ) %
        12;

      return KEY_NAMES[
        normalizedOffset
      ];

    }, [
      selectedKey,
      effectiveTranspose,
    ]);

  /*
  |--------------------------------------------------------------------------
  | KEY SELECTOR CHANGE
  |--------------------------------------------------------------------------
  */

  const handleKeyChange =
    useCallback(
      (
        displayedKey: string
      ) => {

        if (
          !transposeEnabled
        ) {

          setSelectedKey(
            displayedKey
          );

          return;

        }

        const displayedOffset =
          KEY_OFFSETS[
            displayedKey
          ];

        if (
          displayedOffset === undefined
        ) {

          return;

        }

        const baseOffset =
          (
            (
              displayedOffset -
              transposeSemitones
            ) %
            12 +
            12
          ) %
          12;

        const baseKey =
          KEY_NAMES[
            baseOffset
          ];

        setSelectedKey(
          baseKey
        );

      },
      [
        transposeEnabled,
        transposeSemitones,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | TRACKING
  |--------------------------------------------------------------------------
  */

  const [
    trackingResult,
    setTrackingResult,
  ] =
    useState<HandTrackingResult>({
      leftHand:
        null,

      rightHand:
        null,

      timestamp:
        0,
    });

  /*
  |--------------------------------------------------------------------------
  | TRACKING CALLBACK
  |--------------------------------------------------------------------------
  */

  const handleResults =
    useCallback(
      (
        result: HandTrackingResult
      ) => {

        setTrackingResult(
          result
        );

      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | START AUDIO
  |--------------------------------------------------------------------------
  */

  const startAudio =
    useCallback(
      async () => {

        if (
          audioStarted
        ) {
          return;
        }

        try {

          await audioRef.current
            ?.start();

          /*
          |--------------------------------------------------------------------------
          | START AT DEFAULT 30%
          |--------------------------------------------------------------------------
          */

          audioRef.current
            ?.setVolume(
              DEFAULT_VOLUME
            );

          setAudioStarted(
            true
          );

        } catch (
          error
        ) {

          console.error(
            "Audio start failed:",
            error
          );

        }

      },
      [
        audioStarted,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | RAW LEFT
  |--------------------------------------------------------------------------
  */

  const rawLeft =
    useMemo(() => {

      if (
        !trackingResult.leftHand
      ) {

        return null;

      }

      return detectFingers(
        trackingResult.leftHand
      );

    }, [
      trackingResult.leftHand,
    ]);

  /*
  |--------------------------------------------------------------------------
  | RAW RIGHT
  |--------------------------------------------------------------------------
  */

  const rawRight =
    useMemo(() => {

      if (
        !trackingResult.rightHand
      ) {

        return null;

      }

      return detectFingers(
        trackingResult.rightHand
      );

    }, [
      trackingResult.rightHand,
    ]);

  /*
  |--------------------------------------------------------------------------
  | STABLE FINGERS
  |--------------------------------------------------------------------------
  */

  const stableLeft =
    useStableFingers(
      rawLeft
    );

  const stableRight =
    useStableFingers(
      rawRight
    );

  /*
  |--------------------------------------------------------------------------
  | LEFT TILT
  |--------------------------------------------------------------------------
  */

  const leftTilt:
    LeftTiltDirection =
    trackingResult.leftHand?.landmarks
      ? (
          getTiltDirection(
            trackingResult.leftHand.landmarks,
            "Left"
          ) === "INWARD"
            ? "INWARD"
            : "OUTWARD"
        )
      : "OUTWARD";

  /*
  |--------------------------------------------------------------------------
  | LEFT CHORD
  |--------------------------------------------------------------------------
  */

  const leftGesture =
    useMemo(() => {

      const gesture =
        mapLeftGesture(
          stableLeft
        );

      if (
        !gesture
      ) {

        return null;

      }

      const quality:
        ChordQuality =
        leftTilt === "INWARD"
          ? "MINOR"
          : "MAJOR";

      return {

        ...gesture,

        quality,

        tilt:
          leftTilt,

      };

    }, [
      stableLeft,
      leftTilt,
    ]);

  /*
  |--------------------------------------------------------------------------
  | RIGHT SHAPE
  |--------------------------------------------------------------------------
  */

  const rightGesture =
    useMemo(() => {

      return mapRightGesture(
        stableRight
      );

    }, [
      stableRight,
    ]);

  /*
  |--------------------------------------------------------------------------
  | OCTAVE
  |--------------------------------------------------------------------------
  */

  const octave =
    useMemo(() => {

      return mapOctave(
        stableRight
      );

    }, [
      stableRight,
    ]);

  /*
  |--------------------------------------------------------------------------
  | CHORD SEMITONE GESTURE
  |--------------------------------------------------------------------------
  */

  const semitoneGestureActive =
    isChordSemitoneGesture(
      stableRight
    );

  /*
  |--------------------------------------------------------------------------
  | RIGHT TILT
  |--------------------------------------------------------------------------
  */

  const rightTilt =
    useMemo<RightTiltDirection>(() => {

      if (
        !semitoneGestureActive
      ) {

        return "NEUTRAL";

      }

      const landmarks =
        trackingResult
          .rightHand
          ?.landmarks;

      if (
        !landmarks
      ) {

        return "NEUTRAL";

      }

      const angle =
        getRightPalmAngle(
          landmarks
        );

      if (
        angle === null
      ) {

        return "NEUTRAL";

      }

      return getRightTiltFromAngle(
        angle
      );

    }, [
      trackingResult.rightHand,
      semitoneGestureActive,
    ]);

  /*
  |--------------------------------------------------------------------------
  | CHORD SEMITONE
  |--------------------------------------------------------------------------
  */

  const {
    chordSemitone,
  } =
    useChordSemitoneController(
      stableRight
    );

  /*
  |--------------------------------------------------------------------------
  | EFFECTIVE CHORD SEMITONE
  |--------------------------------------------------------------------------
  */

  const effectiveChordSemitone =
    semitoneGestureActive
      ? rightTilt === "INWARD"
        ? -1
        : rightTilt === "OUTWARD"
          ? 1
          : 0
      : chordSemitone;

  const safeChordSemitone =
    Math.max(
      -1,
      Math.min(
        1,
        Math.round(
          effectiveChordSemitone
        )
      )
    );

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE GESTURE
  |--------------------------------------------------------------------------
  */

  const transposeGestureActive =
    isTransposeGesture(
      stableRight
    );

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE EDGE TRIGGER
  |--------------------------------------------------------------------------
  */

  const transposeGestureTriggeredRef =
    useRef(false);

  useEffect(() => {

    if (
      !transposeGestureActive
    ) {

      transposeGestureTriggeredRef.current =
        false;

      return;

    }

    if (
      transposeGestureTriggeredRef.current
    ) {

      return;

    }

    transposeGestureTriggeredRef.current =
      true;

    setTransposeEnabled(
      previous =>
        !previous
    );

    console.log(
      "[TRANSPOSE SWITCH]",
      {
        gesture:
          "THUMB_ALONE",

        action:
          "TOGGLE",

        selectedTranspose:
          transposeSemitones,
      }
    );

  }, [
    transposeGestureActive,
    transposeSemitones,
  ]);

  /*
  |--------------------------------------------------------------------------
  | OCTAVE OFFSET
  |--------------------------------------------------------------------------
  */

  const octaveOffset =
    octave === "HIGHER"
      ? 12
      : octave === "LOWER"
        ? -12
        : 0;

  /*
  |--------------------------------------------------------------------------
  | VOLUME
  |--------------------------------------------------------------------------
  |
  | No right hand:
  |   30%
  |
  | Right hand detected:
  |   Volume follows wrist height.
  |
  |--------------------------------------------------------------------------
  */

  const volume =
    useMemo(() => {

      const landmarks =
        trackingResult
          .rightHand
          ?.landmarks;

      if (
        !landmarks ||
        landmarks.length === 0
      ) {

        return DEFAULT_VOLUME;

      }

      const wrist =
        landmarks[0];

      if (
        !wrist
      ) {

        return DEFAULT_VOLUME;

      }

      const raw =
        1 - wrist.y;

      return Math.max(
        0,
        Math.min(
          1,
          raw
        )
      );

    }, [
      trackingResult.rightHand,
    ]);

  /*
  |--------------------------------------------------------------------------
  | CURRENT NOTES
  |--------------------------------------------------------------------------
  */

  const notes =
    useMemo(() => {

      if (
        !leftGesture
      ) {

        return [];

      }

      return generateChordNotes({

        degree:
          leftGesture.degree,

        quality:
          leftGesture.quality,

        shape:
          rightGesture?.shape ??
          "ROOT",

        key:
          selectedKey,

        scale:
          selectedScale,

        chordSemitone:
          safeChordSemitone,

        transpose:
          effectiveTranspose,

        octaveOffset,

      });

    }, [
      leftGesture,
      rightGesture,
      selectedKey,
      selectedScale,
      safeChordSemitone,
      effectiveTranspose,
      octaveOffset,
    ]);

  /*
  |--------------------------------------------------------------------------
  | EXACT CHORD NAME
  |--------------------------------------------------------------------------
  */

  const chordName =
    useMemo(() => {

      if (
        !leftGesture
      ) {

        return "—";

      }

      const keyOffset =
        KEY_OFFSETS[
          selectedKey
        ];

      const scale =
        SCALE_INTERVALS[
          selectedScale
        ];

      const degreeOffset =
        scale?.[
          leftGesture.degree
        ];

      if (
        keyOffset === undefined ||
        degreeOffset === undefined
      ) {

        return "—";

      }

      const midi =
        60 +
        keyOffset +
        degreeOffset +
        effectiveTranspose +
        safeChordSemitone;

      const note =
        midiToNoteName(
          midi
        );

      return leftGesture.quality ===
        "MINOR"

        ? `${note} minor`

        : `${note} major`;

    }, [
      selectedKey,
      selectedScale,
      leftGesture,
      effectiveTranspose,
      safeChordSemitone,
    ]);

  /*
  |--------------------------------------------------------------------------
  | PREVIOUS NOTES
  |--------------------------------------------------------------------------
  */

  const previousNotesRef =
    useRef<string>("");

  /*
  |--------------------------------------------------------------------------
  | AUDIO → CHORD
  |--------------------------------------------------------------------------
  */

  useLayoutEffect(() => {

    if (
      !audioStarted
    ) {

      return;

    }

    const audio =
      audioRef.current;

    if (
      !audio
    ) {

      return;

    }

    if (
      notes.length === 0
    ) {

      if (
        previousNotesRef.current !== ""
      ) {

        audio.stop();

        previousNotesRef.current =
          "";

      }

      return;

    }

    const notesKey =
      notes.join("|");

    if (
      notesKey ===
      previousNotesRef.current
    ) {

      return;

    }

    audio.play(
      notes
    );

    previousNotesRef.current =
      notesKey;

  }, [
    audioStarted,
    notes,
  ]);

  /*
  |--------------------------------------------------------------------------
  | AUDIO → VOLUME
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    if (
      !audioStarted
    ) {

      return;

    }

    audioRef.current
      ?.setVolume(
        volume
      );

  }, [
    audioStarted,
    volume,
  ]);

  /*
  |--------------------------------------------------------------------------
  | WAVE ACTIVE
  |--------------------------------------------------------------------------
  */

  const waveActive =
    audioStarted &&
    notes.length > 0;

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (

    <main
      style={{
        position:
          "fixed",

        inset:
          0,

        width:
          "100vw",

        height:
          "100vh",

        overflow:
          "hidden",

        background:
          "#050505",

        color:
          "#fff",

        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >

      {/* ========================================================== */}
      {/* FULLSCREEN CAMERA */}
      {/* ========================================================== */}

      <div
        className="camera-fullscreen"
        style={{
          position:
            "absolute",

          inset:
            0,

          zIndex:
            0,

          width:
            "100vw",

          height:
            "100vh",

          minWidth:
            "100vw",

          minHeight:
            "100vh",

          overflow:
            "hidden",

          margin:
            0,

          padding:
            0,
        }}
      >

        <style>
          {`
            .camera-fullscreen,
            .camera-fullscreen > div,
            .camera-fullscreen video,
            .camera-fullscreen canvas {
              position: absolute !important;
              inset: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              min-width: 100vw !important;
              min-height: 100vh !important;
              max-width: none !important;
              max-height: none !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
            }

            .camera-fullscreen video {
              object-fit: cover !important;
              object-position: center center !important;
              display: block !important;
            }

            .camera-fullscreen canvas {
              object-fit: cover !important;
              display: block !important;
            }
          `}
        </style>

        <CameraView
          onResults={
            handleResults
          }

          trackingResult={
            trackingResult
          }
        />

      </div>

      {/* ========================================================== */}
      {/* CAMERA OVERLAY */}
      {/* ========================================================== */}

      <div
        style={{
          position:
            "absolute",

          inset:
            0,

          zIndex:
            1,

          pointerEvents:
            "none",

          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.12) 58%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      {/* ========================================================== */}
      {/* TOP LEFT CONTROL BAR */}
      {/* ========================================================== */}

      <div
        style={{
          position:
            "absolute",

          top:
            "18px",

          left:
            "18px",

          zIndex:
            10,

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "2px",

          padding:
            "5px",

          borderRadius:
            "14px",

          background:
            "rgba(10,10,10,0.70)",

          border:
            "1px solid rgba(255,255,255,0.10)",

          backdropFilter:
            "blur(22px)",

          WebkitBackdropFilter:
            "blur(22px)",

          boxShadow:
            "0 12px 45px rgba(0,0,0,0.35)",
        }}
      >

        {/* ======================================================== */}
        {/* KEY */}
        {/* ======================================================== */}

        <InstrumentSelect
          label="KEY"
          value={
            effectiveKey
          }
          options={[
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
          ]}
          onChange={
            handleKeyChange
          }
        />

        {/* ======================================================== */}
        {/* SCALE */}
        {/* ======================================================== */}

        <InstrumentSelect
          label="SCALE"
          value={
            selectedScale
          }
          options={[
            "MAJOR",
            "MINOR",
          ]}
          onChange={
            setSelectedScale
          }
        />

        {/* ======================================================== */}
        {/* TRANSPOSE */}
        {/* ======================================================== */}

        <TransposeSelector
          value={
            transposeSemitones
          }
          enabled={
            transposeEnabled
          }
          onChange={
            setTransposeSemitones
          }
        />

        {/* ======================================================== */}
        {/* GUIDE */}
        {/* ======================================================== */}

        <button
          type="button"
          aria-label="Open guide"
          onClick={() =>
            setGuideOpen(
              true
            )
          }
          style={{
            width:
              "30px",

            height:
              "30px",

            marginLeft:
              "3px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            borderRadius:
              "9px",

            border:
              "1px solid rgba(255,255,255,0.08)",

            background:
              "rgba(255,255,255,0.055)",

            color:
              "rgba(255,255,255,0.75)",

            fontSize:
              "14px",

            fontWeight:
              700,

            cursor:
              "pointer",
          }}
        >
          ?
        </button>

      </div>

      {/* ========================================================== */}
      {/* TOP RIGHT VOLUME METER */}
      {/* ========================================================== */}

      <div
        style={{
          position:
            "absolute",

          top:
            "18px",

          right:
            "18px",

          zIndex:
            20,

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "12px",

          width:
            "260px",

          minHeight:
            "46px",

          padding:
            "10px 14px",

          boxSizing:
            "border-box",

          borderRadius:
            "14px",

          background:
            "rgba(10,10,10,0.78)",

          border:
            "1px solid rgba(255,255,255,0.12)",

          backdropFilter:
            "blur(22px)",

          WebkitBackdropFilter:
            "blur(22px)",

          boxShadow:
            "0 12px 45px rgba(0,0,0,0.40)",

          pointerEvents:
            "none",
        }}
      >

        <span
          style={{
            fontSize:
              "10px",

            fontWeight:
              700,

            letterSpacing:
              "0.12em",

            opacity:
              0.48,

            whiteSpace:
              "nowrap",
          }}
        >
          VOLUME
        </span>

        <div
          style={{
            flex:
              1,

            width:
              "150px",

            height:
              "10px",

            borderRadius:
              "999px",

            overflow:
              "hidden",

            background:
              "rgba(255,255,255,0.12)",

            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >

          <div
            style={{
              width:
                `${Math.round(volume * 100)}%`,

              height:
                "100%",

              borderRadius:
                "999px",

              background:
                "rgba(255,255,255,0.90)",

              transition:
                "width 45ms linear",
            }}
          />

        </div>

        <span
          style={{
            minWidth:
              "38px",

            fontSize:
              "11px",

            fontWeight:
              650,

            fontVariantNumeric:
              "tabular-nums",

            textAlign:
              "right",

            opacity:
              0.68,
          }}
        >
          {Math.round(
            volume * 100
          )}%
        </span>

      </div>

      {/* ========================================================== */}
      {/* CHORD */}
      {/* ========================================================== */}

      <div
        style={{
          position:
            "absolute",

          left:
            0,

          right:
            0,

          bottom:
            "185px",

          zIndex:
            5,

          display:
            "flex",

          flexDirection:
            "column",

          alignItems:
            "center",

          justifyContent:
            "flex-end",

          pointerEvents:
            "none",

          textAlign:
            "center",

          padding:
            "20px",

          boxSizing:
            "border-box",
        }}
      >

        {!audioStarted ? (

          <button
            type="button"
            onClick={
              startAudio
            }
            style={{
              pointerEvents:
                "auto",

              padding:
                "14px 28px",

              borderRadius:
                "999px",

              border:
                "1px solid rgba(255,255,255,0.16)",

              background:
                "rgba(255,255,255,0.10)",

              color:
                "#fff",

              fontSize:
                "14px",

              fontWeight:
                600,

              cursor:
                "pointer",

              backdropFilter:
                "blur(18px)",

              WebkitBackdropFilter:
                "blur(18px)",

              boxShadow:
                "0 15px 45px rgba(0,0,0,0.30)",
            }}
          >
            Start Instrument
          </button>

        ) : (

          <>

            <div
              style={{
                fontSize:
                  "clamp(42px, 7vw, 82px)",

                lineHeight:
                  0.9,

                fontWeight:
                  700,

                letterSpacing:
                  "-0.06em",

                whiteSpace:
                  "nowrap",

                textShadow:
                  "0 5px 45px rgba(0,0,0,0.65)",
              }}
            >
              {chordName}
            </div>

            <div
              style={{
                marginTop:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  600,

                letterSpacing:
                  "0.14em",

                opacity:
                  transposeEnabled
                    ? 0.55
                    : 0.30,
              }}
            >
              KEY {effectiveKey}
              {" · "}
              {transposeEnabled
                ? "TRANSPOSE ON"
                : "TRANSPOSE OFF"}
            </div>

            <div
              style={{
                marginTop:
                  "9px",

                fontSize:
                  "15px",

                fontWeight:
                  500,

                letterSpacing:
                  "0.16em",

                opacity:
                  leftGesture
                    ? 0.62
                    : 0.20,
              }}
            >
              {leftGesture?.degree ?? "—"}
            </div>

            <div
              style={{
                marginTop:
                  "9px",

                minHeight:
                  "18px",

                fontSize:
                  "11px",

                fontWeight:
                  500,

                letterSpacing:
                  "0.14em",

                opacity:
                  notes.length > 0
                    ? 0.48
                    : 0.14,
              }}
            >
              {notes.length > 0
                ? notes.join("   ")
                : "—"}
            </div>

          </>

        )}

      </div>

      {/* ========================================================== */}
      {/* WAVEFORM */}
      {/* ========================================================== */}

      <div
        style={{
          position:
            "absolute",

          left:
            0,

          right:
            0,

          bottom:
            0,

          height:
            "190px",

          zIndex:
            6,

          pointerEvents:
            "none",

          opacity:
            waveActive
              ? 0.95
              : 0.28,

          overflow:
            "hidden",
        }}
      >

        <Waveform
          active={
            waveActive
          }
        />

      </div>

      {/* ========================================================== */}
      {/* GUIDE */}
      {/* ========================================================== */}

      {guideOpen && (

        <Guide
          onClose={() =>
            setGuideOpen(
              false
            )
          }
        />

      )}

    </main>

  );
}

/*
|--------------------------------------------------------------------------
| INSTRUMENT SELECT
|--------------------------------------------------------------------------
*/

function InstrumentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label:
    string;

  value:
    string;

  options:
    string[];

  onChange:
    (value: string) => void;

}) {

  return (

    <label
      style={{
        display:
          "flex",

        alignItems:
          "center",

        gap:
          "7px",

        padding:
          "7px 9px",

        borderRadius:
          "9px",

        cursor:
          "pointer",

        whiteSpace:
          "nowrap",
      }}
    >

      <span
        style={{
          fontSize:
            "8px",

          fontWeight:
            700,

          letterSpacing:
            "0.12em",

          opacity:
            0.35,
        }}
      >
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={
          event =>
            onChange(
              event.target.value
            )
        }
        style={{
          appearance:
            "none",

          WebkitAppearance:
            "none",

          border:
            "none",

          outline:
            "none",

          background:
            "transparent",

          color:
            "#fff",

          fontFamily:
            "inherit",

          fontSize:
            "12px",

          fontWeight:
            600,

          cursor:
            "pointer",

          padding:
            0,
        }}
      >

        {options.map(
          option => (

            <option
              key={
                option
              }
              value={
                option
              }
              style={{
                background:
                  "#161616",

                color:
                  "#fff",
              }}
            >
              {option}
            </option>

          )
        )}

      </select>

    </label>
  );
}

/*
|--------------------------------------------------------------------------
| TRANSPOSE SELECTOR
|--------------------------------------------------------------------------
*/

function TransposeSelector({
  value,
  enabled,
  onChange,
}: {
  value:
    number;

  enabled:
    boolean;

  onChange:
    (value: number) => void;

}) {

  const decrease =
    () => {

      onChange(
        Math.max(
          -12,
          value - 1
        )
      );

    };

  const increase =
    () => {

      onChange(
        Math.min(
          12,
          value + 1
        )
      );

    };

  return (

    <div
      style={{
        display:
          "flex",

        alignItems:
          "center",

        gap:
          "5px",

        padding:
          "4px 6px",

        borderRadius:
          "10px",

        background:
          enabled
            ? "rgba(255,255,255,0.09)"
            : "rgba(255,255,255,0.045)",
      }}
    >

      <span
        style={{
          marginLeft:
            "3px",

          marginRight:
            "3px",

          fontSize:
            "8px",

          fontWeight:
            700,

          letterSpacing:
            "0.12em",

          opacity:
            enabled
              ? 0.60
              : 0.35,

          whiteSpace:
            "nowrap",
        }}
      >
        TRANSPOSE
      </span>

      <button
        type="button"
        onClick={
          decrease
        }
        disabled={
          value <= -12
        }
        style={{
          width:
            "22px",

          height:
            "22px",

          border:
            "none",

          borderRadius:
            "6px",

          background:
            "rgba(255,255,255,0.06)",

          color:
            "rgba(255,255,255,0.75)",

          cursor:
            value <= -12
              ? "default"
              : "pointer",

          opacity:
            value <= -12
              ? 0.25
              : 1,

          fontSize:
            "15px",

          lineHeight:
            1,
        }}
      >
        −
      </button>

      <select
        value={
          value
        }
        onChange={
          event =>
            onChange(
              Number(
                event.target.value
              )
            )
        }
        aria-label="Transpose amount"
        style={{
          appearance:
            "none",

          WebkitAppearance:
            "none",

          minWidth:
            "38px",

          padding:
            "2px 0",

          border:
            "none",

          outline:
            "none",

          background:
            "transparent",

          color:
            enabled
              ? "#fff"
              : "rgba(255,255,255,0.55)",

          fontFamily:
            "inherit",

          fontSize:
            "12px",

          fontWeight:
            650,

          textAlign:
            "center",

          cursor:
            "pointer",
        }}
      >

        {Array.from(
          {
            length:
              25,
          },
          (
            _,
            index
          ) => {

            const transpose =
              index - 12;

            const label =
              transpose > 0
                ? `+${transpose}`
                : `${transpose}`;

            return (

              <option
                key={
                  transpose
                }
                value={
                  transpose
                }
                style={{
                  background:
                    "#161616",

                  color:
                    "#fff",
                }}
              >
                {label}
              </option>

            );

          }
        )}

      </select>

      <button
        type="button"
        onClick={
          increase
        }
        disabled={
          value >= 12
        }
        style={{
          width:
            "22px",

          height:
            "22px",

          border:
            "none",

          borderRadius:
            "6px",

          background:
            "rgba(255,255,255,0.06)",

          color:
            "rgba(255,255,255,0.75)",

          cursor:
            value >= 12
              ? "default"
              : "pointer",

          opacity:
            value >= 12
              ? 0.25
              : 1,

          fontSize:
            "15px",

          lineHeight:
            1,
        }}
      >
        +
      </button>

    </div>

  );
}

/*
|--------------------------------------------------------------------------
| GUIDE
|--------------------------------------------------------------------------
*/

function Guide({
  onClose,
}: {
  onClose:
    () => void;

}) {

  return (

    <div
      style={{
        position:
          "absolute",

        inset:
          0,

        zIndex:
          100,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          "20px",

        background:
          "rgba(0,0,0,0.62)",

        backdropFilter:
          "blur(20px)",

        WebkitBackdropFilter:
          "blur(20px)",
      }}
      onClick={
        onClose
      }
    >

      <section
        onClick={
          event =>
            event.stopPropagation()
        }
        style={{
          width:
            "min(520px, 100%)",

          maxHeight:
            "90vh",

          overflowY:
            "auto",

          boxSizing:
            "border-box",

          padding:
            "28px",

          borderRadius:
            "22px",

          background:
            "rgba(18,18,18,0.94)",

          border:
            "1px solid rgba(255,255,255,0.10)",

          boxShadow:
            "0 30px 100px rgba(0,0,0,0.55)",
        }}
      >

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            marginBottom:
              "25px",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "22px",

                fontWeight:
                  700,

                letterSpacing:
                  "-0.03em",
              }}
            >
              Gesture Guide
            </div>

            <div
              style={{
                marginTop:
                  "5px",

                fontSize:
                  "12px",

                opacity:
                  0.4,
              }}
            >
              Shape the chord with your hands.
            </div>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={{
              width:
                "32px",

              height:
                "32px",

              borderRadius:
                "50%",

              border:
                "1px solid rgba(255,255,255,0.10)",

              background:
                "rgba(255,255,255,0.05)",

              color:
                "#fff",

              cursor:
                "pointer",

              fontSize:
                "16px",
            }}
          >
            ×
          </button>

        </div>

        <GuideSection
          title="Left hand · chord"
          rows={[
            [
              "Index",
              "I",
            ],
            [
              "Index + Middle",
              "II",
            ],
            [
              "Index + Middle + Ring",
              "III",
            ],
            [
              "Four fingers",
              "IV",
            ],
            [
              "Five fingers",
              "V",
            ],
            [
              "Index + Pinky",
              "VI",
            ],
            [
              "Thumb + Index + Pinky",
              "VII",
            ],
          ]}
        />

        <GuideSection
          title="Left-hand tilt"
          rows={[
            [
              "Inward",
              "Minor",
            ],
            [
              "Outward",
              "Major",
            ],
          ]}
        />

        <GuideSection
          title="Right hand · shape"
          rows={[
            [
              "1 finger",
              "Root",
            ],
            [
              "2 fingers",
              "Inversion",
            ],
            [
              "3 fingers",
              "Seventh",
            ],
            [
              "4 fingers",
              "Dominant / Diminished",
            ],
          ]}
        />

        <GuideSection
          title="Chord semitone"
          rows={[
            [
              "Index + Pinky",
              "Activate",
            ],
            [
              "Inward",
              "−1",
            ],
            [
              "Neutral",
              "0",
            ],
            [
              "Outward",
              "+1",
            ],
          ]}
        />

        <GuideSection
          title="Transpose switch"
          rows={[
            [
              "Thumb alone",
              "Toggle ON / OFF",
            ],
            [
              "Transpose amount",
              "Selected from menu",
            ],
            [
              "Gesture direction",
              "Ignored",
            ],
            [
              "Hold gesture",
              "No repeat",
            ],
            [
              "Release",
              "Re-arm switch",
            ],
          ]}
        />

        <GuideSection
          title="Other controls"
          rows={[
            [
              "Thumb",
              "Lower octave",
            ],
            [
              "Right hand height",
              "Volume",
            ],
            [
              "Transpose menu",
              "−12 → +12",
            ],
          ]}
        />

      </section>

    </div>

  );
}

/*
|--------------------------------------------------------------------------
| GUIDE SECTION
|--------------------------------------------------------------------------
*/

function GuideSection({
  title,
  rows,
}: {
  title:
    string;

  rows:
    [string, string][];

}) {

  return (

    <div
      style={{
        marginTop:
          "22px",
      }}
    >

      <div
        style={{
          marginBottom:
            "9px",

          fontSize:
            "10px",

          fontWeight:
            700,

          letterSpacing:
            "0.14em",

          textTransform:
            "uppercase",

          opacity:
            0.35,
        }}
      >
        {title}
      </div>

      <div>

        {rows.map(
          (
            row,
            index
          ) => (

            <div
              key={
                `${row[0]}-${index}`
              }
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                padding:
                  "9px 0",

                borderBottom:
                  "1px solid rgba(255,255,255,0.055)",

                fontSize:
                  "13px",
              }}
            >

              <span
                style={{
                  opacity:
                    0.65,
                }}
              >
                {row[0]}
              </span>

              <span
                style={{
                  fontWeight:
                    600,

                  opacity:
                    0.9,
                }}
              >
                {row[1]}
              </span>

            </div>

          )
        )}

      </div>

    </div>

  );
}
/*
|--------------------------------------------------------------------------
| WAVEFORM
|--------------------------------------------------------------------------
|
| TWO COUPLED CURRENT WAVES
|
|   Violet  → leading stream
|   Red     → following stream
|
| The two waves share the same current field and continuously interact.
| They converge at the edges, separate through the center, and move
| together as one flowing energy/current.
|
|--------------------------------------------------------------------------
*/

function Waveform({
  active,
}: {
  active:
    boolean;

}) {

  const [
    phase,
    setPhase,
  ] =
    useState(0);

  /*
  |--------------------------------------------------------------------------
  | ANIMATION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    let frame:
      number;

    let last =
      performance.now();

    const animate =
      (
        now:
          number
      ) => {

        const delta =
          now -
          last;

        last =
          now;

        setPhase(
          previous =>
            previous +
            delta *
            (
              active
                ? 0.0038
                : 0.00055
            )
        );

        frame =
          requestAnimationFrame(
            animate
          );

      };

    frame =
      requestAnimationFrame(
        animate
      );

    return () => {

      cancelAnimationFrame(
        frame
      );

    };

  }, [
    active,
  ]);

  /*
  |--------------------------------------------------------------------------
  | CONSTANTS
  |--------------------------------------------------------------------------
  */

  const pointCount =
    360;

  /*
  |--------------------------------------------------------------------------
  | POINT ARRAYS
  |--------------------------------------------------------------------------
  */

  const violetPoints:
    string[] = [];

  const redPoints:
    string[] = [];

  /*
  |--------------------------------------------------------------------------
  | GENERATE COUPLED CURRENT
  |--------------------------------------------------------------------------
  */

  for (
    let index = 0;
    index < pointCount;
    index++
  ) {

    /*
    |--------------------------------------------------------------------------
    | X
    |--------------------------------------------------------------------------
    */

    const x =
      (
        index /
        (pointCount - 1)
      ) *
      100;

    /*
    |--------------------------------------------------------------------------
    | NORMALIZED POSITION
    |--------------------------------------------------------------------------
    */

    const t =
      index /
      (pointCount - 1);

    /*
    |--------------------------------------------------------------------------
    | EDGE FADE
    |--------------------------------------------------------------------------
    |
    | 0 at the edges
    | 1 at the center
    |
    | This is now actually used to control the interaction.
    |
    |--------------------------------------------------------------------------
    */

    const edgeFade =
      Math.sin(
        Math.PI *
        t
      );

    /*
    |--------------------------------------------------------------------------
    | SMOOTH EDGE CURVE
    |--------------------------------------------------------------------------
    |
    | Makes the transition toward the edges softer instead of linear.
    |--------------------------------------------------------------------------
    */

    const edgeCurve =
      edgeFade *
      edgeFade;

    /*
    |--------------------------------------------------------------------------
    | SHARED LARGE CURRENT
    |--------------------------------------------------------------------------
    |
    | Both waves receive exactly the same large-scale movement.
    |--------------------------------------------------------------------------
    */

    const current =
      Math.sin(
        index *
        0.075 +
        phase
      );

    const current2 =
      Math.sin(
        index *
        0.145 -
        phase *
        0.72
      );

    const current3 =
      Math.sin(
        index *
        0.030 +
        phase *
        0.42
      );

    /*
    |--------------------------------------------------------------------------
    | INTERACTION FIELD
    |--------------------------------------------------------------------------
    |
    | Controls how strongly the two streams attract / separate.
    |--------------------------------------------------------------------------
    */

    const interaction =
      Math.sin(
        index *
        0.052 +
        phase *
        0.82
      );

    /*
    |--------------------------------------------------------------------------
    | SMALL TURBULENCE
    |--------------------------------------------------------------------------
    */

    const turbulence =
      Math.sin(
        index *
        0.19 -
        phase *
        1.15
      );

    /*
    |--------------------------------------------------------------------------
    | SHARED VERTICAL FLOW
    |--------------------------------------------------------------------------
    */

    const sharedFlow =
      current *
      8 +

      current2 *
      4.5 +

      current3 *
      3;

    /*
    |--------------------------------------------------------------------------
    | VARIABLE SEPARATION
    |--------------------------------------------------------------------------
    |
    | The waves are no longer separated by a fixed amount.
    |
    | edgeCurve controls the strength of the separation, causing both
    | streams to naturally converge into one current near the edges.
    |--------------------------------------------------------------------------
    */

    const baseSeparation =
      12 +
      interaction *
      8 +
      turbulence *
      2.5;

    const separation =
      baseSeparation *
      edgeCurve;

    /*
    |--------------------------------------------------------------------------
    | LOCAL RIPPLE
    |--------------------------------------------------------------------------
    |
    | Also controlled by edgeFade so the ends remain smooth.
    |--------------------------------------------------------------------------
    */

    const ripple =
      Math.sin(
        index *
        0.31 +
        phase *
        1.55
      ) *
      2.4 *
      edgeFade;

    /*
    |--------------------------------------------------------------------------
    | CURRENT CENTER
    |--------------------------------------------------------------------------
    */

    const center =
      55 +
      sharedFlow;

    /*
    |--------------------------------------------------------------------------
    | INTERACTION OFFSET
    |--------------------------------------------------------------------------
    |
    | This makes the streams lean toward one another rather than simply
    | moving vertically in parallel.
    |--------------------------------------------------------------------------
    */

    const violetInteraction =
      interaction *
      3.5 *
      edgeCurve;

    const redInteraction =
      interaction *
      -3.5 *
      edgeCurve;

    /*
    |--------------------------------------------------------------------------
    | VIOLET STREAM
    |--------------------------------------------------------------------------
    */

    const violetY =
      center -

      separation /
      2 +

      ripple +

      violetInteraction;

    /*
    |--------------------------------------------------------------------------
    | RED STREAM
    |--------------------------------------------------------------------------
    */

    const redY =
      center +

      separation /
      2 -

      ripple +

      redInteraction;

    /*
    |--------------------------------------------------------------------------
    | ADD POINTS
    |--------------------------------------------------------------------------
    */

    violetPoints.push(
      `${x},${violetY}`
    );

    redPoints.push(
      `${x},${redY}`
    );

  }

  /*
  |--------------------------------------------------------------------------
  | PATHS
  |--------------------------------------------------------------------------
  */

  const violetPath =
    violetPoints.join(" ");

  const redPath =
    redPoints.join(" ");

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (

    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        width:
          "100%",

        height:
          "100%",

        display:
          "block",

        overflow:
          "visible",
      }}
    >

      <defs>

        {/* ======================================================== */}
        {/* VIOLET GRADIENT */}
        {/* ======================================================== */}

        <linearGradient
          id="coupledVioletGradient"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >

          <stop
            offset="0%"
            stopColor="#6A00FF"
            stopOpacity="0"
          />

          <stop
            offset="10%"
            stopColor="#8A2BE2"
            stopOpacity="0.70"
          />

          <stop
            offset="28%"
            stopColor="#B84DFF"
            stopOpacity="0.95"
          />

          <stop
            offset="50%"
            stopColor="#E58AFF"
            stopOpacity="1"
          />

          <stop
            offset="72%"
            stopColor="#B84DFF"
            stopOpacity="0.95"
          />

          <stop
            offset="90%"
            stopColor="#8A2BE2"
            stopOpacity="0.70"
          />

          <stop
            offset="100%"
            stopColor="#6A00FF"
            stopOpacity="0"
          />

        </linearGradient>

        {/* ======================================================== */}
        {/* RED GRADIENT */}
        {/* ======================================================== */}

        <linearGradient
          id="coupledRedGradient"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >

          <stop
            offset="0%"
            stopColor="#FF003C"
            stopOpacity="0"
          />

          <stop
            offset="10%"
            stopColor="#FF174F"
            stopOpacity="0.70"
          />

          <stop
            offset="28%"
            stopColor="#FF3D67"
            stopOpacity="0.95"
          />

          <stop
            offset="50%"
            stopColor="#FF8197"
            stopOpacity="1"
          />

          <stop
            offset="72%"
            stopColor="#FF3D67"
            stopOpacity="0.95"
          />

          <stop
            offset="90%"
            stopColor="#FF174F"
            stopOpacity="0.70"
          />

          <stop
            offset="100%"
            stopColor="#FF003C"
            stopOpacity="0"
          />

        </linearGradient>

        {/* ======================================================== */}
        {/* CURRENT GRADIENT */}
        {/* ======================================================== */}

        <linearGradient
          id="coupledCurrentGradient"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >

          <stop
            offset="0%"
            stopColor="#7A00FF"
            stopOpacity="0"
          />

          <stop
            offset="22%"
            stopColor="#A33CFF"
            stopOpacity="0.45"
          />

          <stop
            offset="42%"
            stopColor="#D44DFF"
            stopOpacity="0.75"
          />

          <stop
            offset="56%"
            stopColor="#FF3D5A"
            stopOpacity="0.75"
          />

          <stop
            offset="78%"
            stopColor="#FF174F"
            stopOpacity="0.45"
          />

          <stop
            offset="100%"
            stopColor="#FF003C"
            stopOpacity="0"
          />

        </linearGradient>

        {/* ======================================================== */}
        {/* VIOLET GLOW */}
        {/* ======================================================== */}

        <filter
          id="coupledVioletGlow"
          x="-30%"
          y="-150%"
          width="160%"
          height="400%"
        >

          <feGaussianBlur
            stdDeviation="2.2"
            result="blur"
          />

          <feMerge>

            <feMergeNode
              in="blur"
            />

            <feMergeNode
              in="SourceGraphic"
            />

          </feMerge>

        </filter>

        {/* ======================================================== */}
        {/* RED GLOW */}
        {/* ======================================================== */}

        <filter
          id="coupledRedGlow"
          x="-30%"
          y="-150%"
          width="160%"
          height="400%"
        >

          <feGaussianBlur
            stdDeviation="2.2"
            result="blur"
          />

          <feMerge>

            <feMergeNode
              in="blur"
            />

            <feMergeNode
              in="SourceGraphic"
            />

          </feMerge>

        </filter>

        {/* ======================================================== */}
        {/* CURRENT GLOW */}
        {/* ======================================================== */}

        <filter
          id="coupledCurrentGlow"
          x="-30%"
          y="-150%"
          width="160%"
          height="400%"
        >

          <feGaussianBlur
            stdDeviation="4"
          />

        </filter>

      </defs>

      {/* ========================================================== */}
      {/* BROAD SHARED CURRENT */}
      {/* ========================================================== */}

      <polyline
        points={
          violetPath
        }
        fill="none"
        stroke="url(#coupledCurrentGradient)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.14
            : 0.025
        }
        filter="url(#coupledCurrentGlow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* VIOLET OUTER GLOW */}
      {/* ========================================================== */}

      <polyline
        points={
          violetPath
        }
        fill="none"
        stroke="#9B35FF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.20
            : 0.035
        }
        filter="url(#coupledVioletGlow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* RED OUTER GLOW */}
      {/* ========================================================== */}

      <polyline
        points={
          redPath
        }
        fill="none"
        stroke="#FF3158"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.20
            : 0.035
        }
        filter="url(#coupledRedGlow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* VIOLET MAIN BODY */}
      {/* ========================================================== */}

      <polyline
        points={
          violetPath
        }
        fill="none"
        stroke="url(#coupledVioletGradient)"
        strokeWidth={
          active
            ? 3.2
            : 1.5
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.96
            : 0.18
        }
        filter="url(#coupledVioletGlow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* RED MAIN BODY */}
      {/* ========================================================== */}

      <polyline
        points={
          redPath
        }
        fill="none"
        stroke="url(#coupledRedGradient)"
        strokeWidth={
          active
            ? 3.2
            : 1.5
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.96
            : 0.18
        }
        filter="url(#coupledRedGlow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* VIOLET HOT CORE */}
      {/* ========================================================== */}

      <polyline
        points={
          violetPath
        }
        fill="none"
        stroke="#E0A0FF"
        strokeWidth={
          active
            ? 0.95
            : 0.4
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.92
            : 0.10
        }
        vectorEffect="non-scaling-stroke"
      />

      {/* ========================================================== */}
      {/* RED HOT CORE */}
      {/* ========================================================== */}

      <polyline
        points={
          redPath
        }
        fill="none"
        stroke="#FF8095"
        strokeWidth={
          active
            ? 0.95
            : 0.4
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={
          active
            ? 0.92
            : 0.10
        }
        vectorEffect="non-scaling-stroke"
      />

    </svg>

  );
}

/*
|--------------------------------------------------------------------------
| CHORD BUILD INPUT
|--------------------------------------------------------------------------
*/

interface ChordBuildInput {

  degree:
    string;

  quality:
    ChordQuality;

  shape:
    ChordShape;

  key:
    string;

  scale:
    string;

  chordSemitone:
    number;

  transpose:
    number;

  octaveOffset:
    number;
}

/*
|--------------------------------------------------------------------------
| GENERATE CHORD NOTES
|--------------------------------------------------------------------------
*/

function generateChordNotes(
  input:
    ChordBuildInput
): string[] {

  const keyOffset =
    KEY_OFFSETS[
      input.key
    ];

  if (
    keyOffset === undefined
  ) {

    return [];

  }

  const scale =
    SCALE_INTERVALS[
      input.scale
    ];

  if (
    !scale
  ) {

    return [];

  }

  const degreeOffset =
    scale[
      input.degree
    ];

  if (
    degreeOffset === undefined
  ) {

    return [];

  }

  /*
  |--------------------------------------------------------------------------
  | ROOT
  |--------------------------------------------------------------------------
  */

  let root =
    60 +
    keyOffset +
    degreeOffset;

  /*
  |--------------------------------------------------------------------------
  | CHORD SEMITONE
  |--------------------------------------------------------------------------
  */

  root +=
    input.chordSemitone;

  /*
  |--------------------------------------------------------------------------
  | TRANSPOSE
  |--------------------------------------------------------------------------
  */

  root +=
    input.transpose;

  /*
  |--------------------------------------------------------------------------
  | OCTAVE
  |--------------------------------------------------------------------------
  */

  root +=
    input.octaveOffset;

  let intervals:
    number[];

  /*
  |--------------------------------------------------------------------------
  | ROOT
  |--------------------------------------------------------------------------
  */

  if (
    input.shape ===
    "ROOT"
  ) {

    intervals =
      input.quality ===
      "MINOR"

        ? [
            0,
            3,
            7,
          ]

        : [
            0,
            4,
            7,
          ];

  }

  /*
  |--------------------------------------------------------------------------
  | INVERSION
  |--------------------------------------------------------------------------
  */

  else if (
    input.shape ===
    "INVERSION"
  ) {

    intervals =
      input.quality ===
      "MINOR"

        ? [
            3,
            7,
            12,
          ]

        : [
            4,
            7,
            12,
          ];

  }

  /*
  |--------------------------------------------------------------------------
  | SEVENTH
  |--------------------------------------------------------------------------
  */

  else if (
    input.shape ===
    "SEVENTH"
  ) {

    intervals =
      input.quality ===
      "MINOR"

        ? [
            0,
            3,
            7,
            10,
          ]

        : [
            0,
            4,
            7,
            11,
          ];

  }

  /*
  |--------------------------------------------------------------------------
  | DOMINANT / DIMINISHED
  |--------------------------------------------------------------------------
  */

  else {

    intervals =
      input.quality ===
      "MINOR"

        ? [
            0,
            3,
            6,
            9,
          ]

        : [
            0,
            4,
            7,
            10,
          ];

  }

  /*
  |--------------------------------------------------------------------------
  | MIDI → NOTE
  |--------------------------------------------------------------------------
  */

  return intervals.map(
    interval =>
      midiToNote(
        root +
        interval
      )
  );
}

/*
|--------------------------------------------------------------------------
| MIDI → NOTE
|--------------------------------------------------------------------------
*/

function midiToNote(
  midi:
    number
): string {

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
    KEY_NAMES[
      safeMidi % 12
    ];

  const octave =
    Math.floor(
      safeMidi / 12
    ) - 1;

  return `${note}${octave}`;
}

/*
|--------------------------------------------------------------------------
| MIDI → NOTE NAME
|--------------------------------------------------------------------------
*/

function midiToNoteName(
  midi:
    number
): string {

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

  return KEY_NAMES[
    safeMidi % 12
  ];
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export default App;
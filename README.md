# Gesture Synth

A real-time browser-based gesture instrument that turns hand movements
into musical chords.

Gesture Synth uses the camera to track both hands and maps finger
combinations, hand tilt, palm orientation, and hand height to musical
controls. The result is an instrument that can be played without a
keyboard or physical MIDI controller.

## Features

- **Real-time hand-controlled chords**
  - Left-hand finger combinations select scale degrees.
  - Left-hand tilt selects major or minor quality.
  - Right-hand finger combinations select chord shapes.

- **Chord shaping**
  - Root triads
  - Inversions
  - Seventh chords
  - Dominant / diminished shapes
  - ±1 semitone chord movement

- **Transpose control**
  - Select a transpose amount from **−12 to +12 semitones**.
  - A dedicated thumb gesture toggles transpose **ON/OFF**.
  - The gesture acts as a switch rather than continuously changing
    the transpose amount.

- **Octave control**
  - Right-hand gestures can shift the instrument by an octave.
  - The default state uses the higher octave.
  - Extending the thumb with a finger switches to the lower octave.
  - Closing the thumb returns to the default higher octave.

- **Gesture-controlled volume**
  - Right-hand wrist height controls volume.
  - With no right hand detected, the instrument returns to the
    default volume.

- **Visual feedback**
  - Fullscreen camera view
  - Current chord and notes
  - Key, scale, and transpose state
  - Animated coupled violet/red waveform
  - Built-in gesture guide

- **Web Audio playback**
  - Chords are generated as MIDI-style note values and passed to the
    audio engine for playback.

- **Experimental screen recording**
  - Record the selected screen, window, or browser tab.
  - Record Gesture Synth instrument audio.
  - Optional microphone recording.
  - Mix instrument audio and microphone audio directly in the browser.
  - No recording server is required.

## Gesture Map

### Left hand — chord degree

| Gesture | Degree |
| --- | --- |
| Index | I |
| Index + Middle | II |
| Index + Middle + Ring | III |
| Four fingers | IV |
| Five fingers | V |
| Index + Pinky | VI |
| Thumb + Index + Pinky | VII |

### Left-hand tilt

| Tilt | Chord quality |
| --- | --- |
| Inward | Minor |
| Outward | Major |

### Right hand — chord shape

| Fingers | Shape |
| --- | --- |
| 1 | Root |
| 2 | Inversion |
| 3 | Seventh |
| 4 | Dominant / Diminished |

### Chord semitone control

The **Index + Pinky** gesture activates semitone control.

| Palm direction | Result |
| --- | --- |
| Inward | −1 semitone |
| Neutral | 0 |
| Outward | +1 semitone |

### Transpose switch

| Gesture | Action |
| --- | --- |
| Thumb alone | Toggle transpose ON/OFF |
| Hold | No repeated toggles |
| Release | Re-arm the switch |

The transpose gesture does **not** determine the transpose amount. The
amount is selected independently from the transpose control.

### Octave control

| Gesture | Result |
| --- | --- |
| Normal right-hand gesture | Higher octave |
| Thumb + any finger | Lower octave |
| Thumb closes | Return to higher octave |

The octave is derived from the current gesture rather than being stored as
persistent octave state.

### Other controls

| Control | Function |
| --- | --- |
| Right-hand height | Volume |
| Octave gesture | ±1 octave |
| Transpose selector | −12 to +12 semitones |

## Musical Model

The instrument starts from the selected key and scale, maps the detected
left-hand degree to a scale interval, and then applies the active chord
controls.

Conceptually:

```text
Selected Key
     ↓
Selected Scale
     ↓
Left-hand Degree
     ↓
Chord Quality
     ↓
Chord Shape
     ↓
Semitone Offset
     ↓
Transpose
     ↓
Octave Offset
     ↓
Generated Notes
     ↓
Audio Engine

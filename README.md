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

## Gesture Map

### Left hand --- chord degree

Gesture Degree

---

Index I
Index + Middle II
Index + Middle + Ring III
Four fingers IV
Five fingers V
Index + Pinky VI
Thumb + Index + Pinky VII

### Left-hand tilt

Tilt Chord quality

---

Inward Minor
Outward Major

### Right hand --- chord shape

Fingers Shape

---

1 Root
2 Inversion
3 Seventh
4 Dominant / Diminished

### Chord semitone control

The **Index + Pinky** gesture activates semitone control.

Palm direction Result

---

Inward −1 semitone
Neutral 0
Outward +1 semitone

### Transpose switch

Gesture Action

---

Thumb alone Toggle transpose ON/OFF
Hold No repeated toggles
Release Re-arm the switch

The transpose gesture does **not** determine the transpose amount. The
amount is selected independently from the transpose control.

### Other controls

Control Function

---

Right-hand height Volume
Octave gesture ±1 octave
Transpose selector −12 to +12 semitones

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
```

### Supported scales

Currently the application defines:

- Major
- Minor

### Note generation

The application uses the chromatic note set:

```text
C  C#  D  D#  E  F  F#  G  G#  A  A#  B
```

Chord construction is based on semitone intervals. Generated MIDI values
are clamped to the standard MIDI range before being converted to note
names.

## Visual Waveform

The bottom of the interface contains two animated streams:

- Violet
- Red

They are intentionally coupled rather than being independent sine waves.
Both streams share a common current field, with changing separation,
interaction, turbulence, and edge fading.

The visual system is designed to make the two waves feel like parts of
the same flowing current.

## Architecture

The main application is organized around a few focused modules:

```text
src/
├── App.tsx
├── audio/
│   └── AudioEngine
├── components/
│   └── CameraView
└── gestures/
    ├── FingerDetector
    ├── GestureMapper
    ├── GestureStabilizer
    ├── ChordSemitoneController
    ├── TiltDetector
    └── types
```

### `App.tsx`

Coordinates the application state and connects:

```text
Camera
  ↓
Hand Tracking
  ↓
Finger Detection
  ↓
Gesture Stabilization
  ↓
Gesture Mapping
  ↓
Musical State
  ↓
Chord Generation
  ↓
Audio Engine
```

It also owns the main interface, gesture guide, controls, chord display,
volume meter, and waveform visualization.

### Gesture detection

Raw hand-tracking landmarks are converted into finger states by
`FingerDetector`.

The resulting states are passed through `GestureStabilizer` to prevent
noisy camera tracking from causing rapid gesture changes.

`GestureMapper` then converts stable finger combinations into musical
actions.

### Audio

`AudioEngine` is responsible for starting the audio system, setting
volume, playing generated notes, and stopping playback.

The application waits for an explicit user interaction before starting
audio so it can comply with browser audio restrictions.

## Getting Started

### Requirements

- Node.js
- npm
- A modern browser with camera access
- A working webcam
- Permission to use the camera

### Installation

Clone the repository:

```bash
gh repo clone workwithshabd/Gesture_Synth
cd <Gesture_Synth >
```

Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open the local development URL shown by the terminal.

### Production build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

> The exact commands depend on the package scripts configured in
> `package.json`.

## Using the Instrument

1. Open the application in a supported browser.
2. Allow camera access.
3. Click **Start Instrument** to initialize audio.
4. Select a key and scale.
5. Use the left hand to select a chord degree.
6. Tilt the left hand inward or outward to select minor or major.
7. Use the right hand to select the chord shape.
8. Use the semitone gesture when you want a ±1 semitone adjustment.
9. Adjust the transpose amount using the transpose selector.
10. Use the thumb-alone gesture to toggle transpose.
11. Move the right hand vertically to control volume.
12. Use the **?** button for the in-app gesture reference.

## Transpose Behaviour

Transpose is intentionally split into two independent controls.

### Amount

The transpose selector chooses the amount:

```text
−12 ... −1
 0
+1 ... +12
```

### Enable / disable

The thumb-alone gesture only toggles whether that amount is active.

For example:

```text
Key = C
Transpose = +3

Transpose OFF → C
Transpose ON  → D#

Transpose OFF → C
Transpose ON  → D#
```

Changing the transpose amount does not require changing the gesture.

## Stability

Camera-based hand tracking can produce noisy landmark data. Gesture
stabilization is therefore part of the control pipeline.

The application also uses edge-triggered behaviour for the transpose
gesture:

```text
Gesture appears
     ↓
Toggle once
     ↓
Gesture held
     ↓
No additional toggles
     ↓
Gesture released
     ↓
Switch is re-armed
```

This prevents a single held gesture from rapidly toggling the transpose
state on every video frame.

## Browser Permissions

The application requires:

- **Camera permission** for hand tracking.
- **Audio interaction** initiated by the user before sound playback.

If camera access is denied, hand-controlled interaction will not work.

If audio does not start, reload the page and press **Start Instrument**
after allowing audio/browser permissions.

## Performance Notes

Hand tracking and waveform rendering are both real-time workloads.

For best results:

- Use a modern desktop or laptop.
- Keep the camera image reasonably well lit.
- Avoid excessive background clutter.
- Keep your hands clearly visible.
- Avoid rapidly moving outside the camera frame.
- Use a browser with hardware acceleration enabled where available.

The waveform uses `requestAnimationFrame` and dynamically generated SVG
polylines. Gesture processing is driven by the incoming tracking
results.

## Project Status

Gesture Synth is an experimental interactive musical instrument.

The current implementation focuses on:

- Reliable gesture-to-chord mapping
- Stable real-time interaction
- Low-friction musical controls
- Visual feedback
- Browser-based audio

The architecture is intentionally modular so additional gestures,
scales, chord types, instruments, and visualizations can be added
without replacing the core interaction model.

## Roadmap

Potential future improvements:

- Additional scales and modes
- More chord qualities
- Custom chord voicings
- MIDI input/output
- Multiple instruments
- Preset management
- Gesture sensitivity controls
- Audio effects
- Recording / looping
- Better mobile camera support
- Configurable gesture mappings
- More advanced fluid/wave visualization

## Contributing

Contributions are welcome.

Before submitting a change:

1. Keep gesture behaviour deterministic.
2. Avoid introducing gesture conflicts.
3. Keep audio logic separate from UI logic.
4. Test with an actual camera rather than only synthetic landmark data.
5. Verify that changes do not cause repeated gesture triggers.
6. Run the project's type-check/build commands before opening a pull
   request.

For larger changes, explain the interaction model and why the change is
necessary.

## License

Add the project's chosen license here.

For example:

```text
MIT License
```

Do not claim a license until one has actually been selected and added to
the repository.

## Credits

Built with React, TypeScript, browser camera/hand-tracking technology,
and Web Audio.

The project combines computer vision, gesture recognition, music theory,
audio synthesis, and real-time visual feedback into a single browser
instrument.

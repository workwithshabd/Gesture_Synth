export type RootNote =
  | "C"
  | "C#"
  | "Db"
  | "D"
  | "D#"
  | "Eb"
  | "E"
  | "F"
  | "F#"
  | "Gb"
  | "G"
  | "G#"
  | "Ab"
  | "A"
  | "A#"
  | "Bb"
  | "B";

export type ScaleName =
  | "major"
  | "naturalMinor"
  | "dorian"
  | "mixolydian"
  | "pentatonic"
  | "blues";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "major7"
  | "minor7"
  | "dominant7"
  | "diminished7";

export type TriadQuality =
  | "major"
  | "minor";

export type Voicing =
  | "root"
  | "firstInversion"
  | "majorMinor7"
  | "dominantDiminished7";

export type LeftHandTilt =
  | "inward"
  | "outward"
  | "neutral";

export type RightHandTilt =
  | "inward"
  | "outward"
  | "neutral";

export type OctaveDirection =
  | "up"
  | "down"
  | "normal";

export interface ScaleState {
  root: RootNote;
  name: ScaleName;
}

export interface ChordState {
  root: RootNote;
  quality: ChordQuality;
  degree?: number;
}

export interface TransposeState {
  chordSemitones: number;
  keySemitones: number;
}

export interface LeftHandState {
  degree: number;
  quality: TriadQuality;
  tilt: LeftHandTilt;
}

export interface RightHandState {
  fingerCount: number;
  voicing: Voicing;
  octave: OctaveDirection;
  tilt: RightHandTilt;
}

export interface MusicState {
  key: RootNote;
  scale: ScaleName;

  chord: ChordState | null;

  leftHand: LeftHandState | null;
  rightHand: RightHandState | null;

  chordTranspose: number;
  keyTranspose: number;
}
/*
|--------------------------------------------------------------------------
| RecordingEngine.ts
|--------------------------------------------------------------------------
|
| Recording modes:
|
|   SCREEN
|       Screen video only.
|
|   PERFORMANCE
|       Screen video
|       +
|       Microphone
|       +
|       Instrument audio
|
|--------------------------------------------------------------------------
*/

import type { AudioMixer } from "./AudioMixer";

import type {
  RecordingMode,
  RecordingOptions,
  RecordingResult,
  RecordingState,
} from "./types";

export class RecordingEngine {
  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  private state: RecordingState = "IDLE";

  /*
  |--------------------------------------------------------------------------
  | MEDIA RECORDER
  |--------------------------------------------------------------------------
  */

  private recorder: MediaRecorder | null = null;

  /*
  |--------------------------------------------------------------------------
  | RECORDING CHUNKS
  |--------------------------------------------------------------------------
  */

  private chunks: Blob[] = [];

  /*
  |--------------------------------------------------------------------------
  | SCREEN STREAM
  |--------------------------------------------------------------------------
  */

  private screenStream: MediaStream | null = null;

  /*
  |--------------------------------------------------------------------------
  | MICROPHONE STREAM
  |--------------------------------------------------------------------------
  */

  private microphoneStream: MediaStream | null = null;

  /*
  |--------------------------------------------------------------------------
  | FINAL RECORDING STREAM
  |--------------------------------------------------------------------------
  */

  private recordingStream: MediaStream | null = null;

  /*
  |--------------------------------------------------------------------------
  | START TIME
  |--------------------------------------------------------------------------
  */

  private startedAt: number | null = null;

  /*
  |--------------------------------------------------------------------------
  | CURRENT MODE
  |--------------------------------------------------------------------------
  */

  private mode: RecordingMode | null = null;

  /*
  |--------------------------------------------------------------------------
  | AUDIO MIXER
  |--------------------------------------------------------------------------
  */

  private mixer: AudioMixer | null = null;

  /*
  |--------------------------------------------------------------------------
  | GET STATE
  |--------------------------------------------------------------------------
  */

  getState(): RecordingState {
    return this.state;
  }

  /*
  |--------------------------------------------------------------------------
  | IS RECORDING
  |--------------------------------------------------------------------------
  */

  isRecording(): boolean {
    return this.state === "RECORDING" || this.state === "STARTING";
  }

  /*
  |--------------------------------------------------------------------------
  | GET MODE
  |--------------------------------------------------------------------------
  */

  getMode(): RecordingMode | null {
    return this.mode;
  }

  /*
  |--------------------------------------------------------------------------
  | START SCREEN RECORDING
  |--------------------------------------------------------------------------
  */

  async start(options: RecordingOptions): Promise<void> {
    if (this.isRecording()) {
      throw new Error("A recording is already in progress.");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Screen recording is not supported by this browser.");
    }

    this.state = "STARTING";

    this.mode = options.mode;

    this.chunks = [];

    try {
      /*
      |--------------------------------------------------------------------------
      | REQUEST SCREEN
      |--------------------------------------------------------------------------
      */

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      /*
      |--------------------------------------------------------------------------
      | SCREEN VIDEO TRACK
      |--------------------------------------------------------------------------
      */

      const videoTrack = this.screenStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("No screen video track was returned.");
      }

      /*
      |--------------------------------------------------------------------------
      | PERFORMANCE AUDIO
      |--------------------------------------------------------------------------
      */

      if (options.mode === "PERFORMANCE") {
        await this.setupPerformanceAudio();
      }

      /*
      |--------------------------------------------------------------------------
      | BUILD FINAL STREAM
      |--------------------------------------------------------------------------
      */

      const videoTracks = this.screenStream.getVideoTracks();

      const audioTracks = this.getRecordingAudioTracks();

      this.recordingStream = new MediaStream([...videoTracks, ...audioTracks]);

      /*
      |--------------------------------------------------------------------------
      | CREATE MEDIA RECORDER
      |--------------------------------------------------------------------------
      */

      const mimeType = this.getSupportedMimeType();

      this.recorder = mimeType
        ? new MediaRecorder(this.recordingStream, {
            mimeType,
          })
        : new MediaRecorder(this.recordingStream);

      /*
      |--------------------------------------------------------------------------
      | DATA
      |--------------------------------------------------------------------------
      */

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      /*
      |--------------------------------------------------------------------------
      | SCREEN SHARE ENDED
      |--------------------------------------------------------------------------
      */

      videoTrack.onended = () => {
        if (this.state === "RECORDING") {
          void this.stop();
        }
      };

      /*
      |--------------------------------------------------------------------------
      | START
      |--------------------------------------------------------------------------
      */

      this.startedAt = performance.now();

      this.recorder.start(250);

      this.state = "RECORDING";
    } catch (error) {
      this.cleanup();

      this.state = "ERROR";

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SETUP PERFORMANCE AUDIO
  |--------------------------------------------------------------------------
  |
  | This method currently expects the AudioMixer to have been supplied
  | through setAudioMixer().
  |
  |--------------------------------------------------------------------------
  */

  private async setupPerformanceAudio(): Promise<void> {
    if (!this.mixer) {
      throw new Error("AudioMixer has not been configured.");
    }

    /*
    |--------------------------------------------------------------------------
    | Get microphone
    |--------------------------------------------------------------------------
    */

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone recording is not supported by this browser.");
    }

    this.microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    /*
    |--------------------------------------------------------------------------
    | Add microphone to mixer.
    |--------------------------------------------------------------------------
    */

    this.mixer.addMicrophone(this.microphoneStream);

    /*
    |--------------------------------------------------------------------------
    | Instrument stream
    |--------------------------------------------------------------------------
    |
    | The AudioEngine's Tone recording stream will be supplied to the mixer
    | by the application layer.
    |
    |--------------------------------------------------------------------------
    */
  }

  /*
  |--------------------------------------------------------------------------
  | SET AUDIO MIXER
  |--------------------------------------------------------------------------
  */

  setAudioMixer(mixer: AudioMixer): void {
    this.mixer = mixer;
  }

  /*
  |--------------------------------------------------------------------------
  | ADD INSTRUMENT STREAM
  |--------------------------------------------------------------------------
  |
  | Called by the application once AudioEngine provides its recording
  | stream.
  |
  |--------------------------------------------------------------------------
  */

  setInstrumentStream(stream: MediaStream): void {
    if (!this.mixer) {
      throw new Error("AudioMixer has not been configured.");
    }

    this.mixer.addInstrumentStream(stream);
  }

  /*
  |--------------------------------------------------------------------------
  | GET RECORDING AUDIO TRACKS
  |--------------------------------------------------------------------------
  */

  private getRecordingAudioTracks(): MediaStreamTrack[] {
    /*
    |--------------------------------------------------------------------------
    | SCREEN MODE
    |--------------------------------------------------------------------------
    */

    if (this.mode === "SCREEN") {
      return [];
    }

    /*
    |--------------------------------------------------------------------------
    | PERFORMANCE MODE
    |--------------------------------------------------------------------------
    */

    if (!this.mixer) {
      throw new Error("AudioMixer has not been configured.");
    }

    return this.mixer.getStream().getAudioTracks();
  }

  /*
  |--------------------------------------------------------------------------
  | STOP
  |--------------------------------------------------------------------------
  */

  async stop(): Promise<RecordingResult | null> {
    if (!this.recorder || this.state !== "RECORDING") {
      return null;
    }

    this.state = "STOPPING";

    const recorder = this.recorder;

    const result = await new Promise<RecordingResult>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const duration =
            this.startedAt === null
              ? 0
              : (performance.now() - this.startedAt) / 1000;

          const mimeType = recorder.mimeType || "video/webm";

          const blob = new Blob(this.chunks, {
            type: mimeType,
          });

          const url = URL.createObjectURL(blob);

          resolve({
            blob,
            url,
            mode: this.mode ?? "SCREEN",
            duration,
          });
        } catch (error) {
          reject(error);
        }
      };

      try {
        recorder.stop();
      } catch (error) {
        reject(error);
      }
    });

    this.cleanup();

    this.state = "IDLE";

    return result;
  }

  /*
  |--------------------------------------------------------------------------
  | CANCEL
  |--------------------------------------------------------------------------
  */

  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // Ignore shutdown errors.
      }
    }

    this.cleanup();

    this.state = "IDLE";
  }

  /*
  |--------------------------------------------------------------------------
  | MIME TYPE
  |--------------------------------------------------------------------------
  */

  private getSupportedMimeType(): string | null {
    const types = [
      "video/webm;codecs=vp9,opus",

      "video/webm;codecs=vp8,opus",

      "video/webm",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | CLEANUP
  |--------------------------------------------------------------------------
  */

  private cleanup(): void {
    /*
    |--------------------------------------------------------------------------
    | Stop recorder streams.
    |--------------------------------------------------------------------------
    */

    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Stop screen.
    |--------------------------------------------------------------------------
    */

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Stop microphone.
    |--------------------------------------------------------------------------
    */

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Remove mixer sources.
    |--------------------------------------------------------------------------
    */

    if (this.mixer) {
      this.mixer.removeMicrophone();

      this.mixer.removeInstrumentStream();
    }

    /*
    |--------------------------------------------------------------------------
    | Reset.
    |--------------------------------------------------------------------------
    */

    this.recordingStream = null;

    this.screenStream = null;

    this.microphoneStream = null;

    this.recorder = null;

    this.chunks = [];

    this.startedAt = null;

    this.mode = null;
  }
}

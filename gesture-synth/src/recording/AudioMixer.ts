/*
|--------------------------------------------------------------------------
| AudioMixer.ts
|--------------------------------------------------------------------------
|
| Gesture Synth Recording Audio Mixer
|
| PERFORMANCE recording audio:
|
|   Microphone ───────┐
|                     │
|                     ├──→ Mixer → Recording Stream
|                     │
|   Tone.js ──────────┘
|
|--------------------------------------------------------------------------
*/

export class AudioMixer {
  /*
  |--------------------------------------------------------------------------
  | AUDIO CONTEXT
  |--------------------------------------------------------------------------
  */

  private context: AudioContext | null = null;

  /*
  |--------------------------------------------------------------------------
  | RECORDING DESTINATION
  |--------------------------------------------------------------------------
  */

  private destination: MediaStreamAudioDestinationNode | null = null;

  /*
  |--------------------------------------------------------------------------
  | MICROPHONE SOURCE
  |--------------------------------------------------------------------------
  */

  private microphoneSource: MediaStreamAudioSourceNode | null = null;

  /*
  |--------------------------------------------------------------------------
  | MICROPHONE STREAM
  |--------------------------------------------------------------------------
  */

  private microphoneStream: MediaStream | null = null;

  /*
  |--------------------------------------------------------------------------
  | MICROPHONE GAIN
  |--------------------------------------------------------------------------
  */

  private microphoneGain: GainNode | null = null;

  /*
  |--------------------------------------------------------------------------
  | INSTRUMENT SOURCE
  |--------------------------------------------------------------------------
  */

  private instrumentSource: MediaStreamAudioSourceNode | null = null;

  /*
  |--------------------------------------------------------------------------
  | INSTRUMENT GAIN
  |--------------------------------------------------------------------------
  */

  private instrumentGain: GainNode | null = null;

  /*
  |--------------------------------------------------------------------------
  | INITIALIZE
  |--------------------------------------------------------------------------
  */

  initialize(context: AudioContext): void {
    /*
    |--------------------------------------------------------------------------
    | Reuse existing context.
    |--------------------------------------------------------------------------
    */

    if (this.context === context && this.destination) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Clean old graph.
    |--------------------------------------------------------------------------
    */

    this.dispose();

    /*
    |--------------------------------------------------------------------------
    | Save context.
    |--------------------------------------------------------------------------
    */

    this.context = context;

    /*
    |--------------------------------------------------------------------------
    | Create recording destination.
    |--------------------------------------------------------------------------
    */

    this.destination = context.createMediaStreamDestination();

    /*
    |--------------------------------------------------------------------------
    | Create microphone gain.
    |--------------------------------------------------------------------------
    */

    this.microphoneGain = context.createGain();

    this.microphoneGain.gain.value = 1;

    /*
    |--------------------------------------------------------------------------
    | Create instrument gain.
    |--------------------------------------------------------------------------
    */

    this.instrumentGain = context.createGain();

    this.instrumentGain.gain.value = 1;
  }

  /*
  |--------------------------------------------------------------------------
  | GET CONTEXT
  |--------------------------------------------------------------------------
  */

  getContext(): AudioContext {
    if (!this.context) {
      throw new Error("AudioMixer has not been initialized.");
    }

    return this.context;
  }

  /*
  |--------------------------------------------------------------------------
  | GET DESTINATION
  |--------------------------------------------------------------------------
  */

  getDestination(): MediaStreamAudioDestinationNode {
    if (!this.destination) {
      throw new Error("AudioMixer has not been initialized.");
    }

    return this.destination;
  }

  /*
  |--------------------------------------------------------------------------
  | ADD MICROPHONE
  |--------------------------------------------------------------------------
  */

  addMicrophone(stream: MediaStream): void {
    /*
    |--------------------------------------------------------------------------
    | Remove previous microphone.
    |--------------------------------------------------------------------------
    */

    this.removeMicrophone();

    /*
    |--------------------------------------------------------------------------
    | Save stream.
    |--------------------------------------------------------------------------
    */

    this.microphoneStream = stream;

    /*
    |--------------------------------------------------------------------------
    | Create source.
    |--------------------------------------------------------------------------
    */

    this.microphoneSource = this.getContext().createMediaStreamSource(stream);

    /*
    |--------------------------------------------------------------------------
    | Connect microphone → gain → recording destination.
    |--------------------------------------------------------------------------
    */

    this.microphoneSource.connect(this.getMicrophoneGain());

    this.getMicrophoneGain().connect(this.getDestination());
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE MICROPHONE
  |--------------------------------------------------------------------------
  */

  removeMicrophone(): void {
    if (this.microphoneSource) {
      try {
        this.microphoneSource.disconnect();
      } catch {
        /*
        | Already disconnected.
        */
      }
    }

    if (this.microphoneGain) {
      try {
        this.microphoneGain.disconnect();
      } catch {
        /*
        | Already disconnected.
        */
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Stop microphone tracks.
    |--------------------------------------------------------------------------
    */

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    this.microphoneSource = null;

    this.microphoneStream = null;
  }

  /*
  |--------------------------------------------------------------------------
  | ADD INSTRUMENT
  |--------------------------------------------------------------------------
  |
  | Takes the MediaStream produced by AudioEngine.getRecordingStream().
  |
  |--------------------------------------------------------------------------
  */

  addInstrumentStream(stream: MediaStream): void {
    /*
    |--------------------------------------------------------------------------
    | Remove previous instrument source.
    |--------------------------------------------------------------------------
    */

    this.removeInstrumentStream();

    /*
    |--------------------------------------------------------------------------
    | Create source.
    |--------------------------------------------------------------------------
    */

    this.instrumentSource = this.getContext().createMediaStreamSource(stream);

    /*
    |--------------------------------------------------------------------------
    | Connect instrument → gain → recording destination.
    |--------------------------------------------------------------------------
    */

    this.instrumentSource.connect(this.getInstrumentGain());

    this.getInstrumentGain().connect(this.getDestination());
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE INSTRUMENT
  |--------------------------------------------------------------------------
  */

  removeInstrumentStream(): void {
    if (this.instrumentSource) {
      try {
        this.instrumentSource.disconnect();
      } catch {
        /*
        | Already disconnected.
        */
      }
    }

    this.instrumentSource = null;
  }

  /*
  |--------------------------------------------------------------------------
  | MICROPHONE VOLUME
  |--------------------------------------------------------------------------
  */

  setMicrophoneVolume(value: number): void {
    const safeValue = Math.max(0, Math.min(2, value));

    const gain = this.getMicrophoneGain();

    gain.gain.setValueAtTime(safeValue, this.getContext().currentTime);
  }

  /*
  |--------------------------------------------------------------------------
  | INSTRUMENT VOLUME
  |--------------------------------------------------------------------------
  */

  setInstrumentVolume(value: number): void {
    const safeValue = Math.max(0, Math.min(2, value));

    const gain = this.getInstrumentGain();

    gain.gain.setValueAtTime(safeValue, this.getContext().currentTime);
  }

  /*
  |--------------------------------------------------------------------------
  | GET MICROPHONE GAIN
  |--------------------------------------------------------------------------
  */

  private getMicrophoneGain(): GainNode {
    if (!this.microphoneGain) {
      throw new Error("AudioMixer has not been initialized.");
    }

    return this.microphoneGain;
  }

  /*
  |--------------------------------------------------------------------------
  | GET INSTRUMENT GAIN
  |--------------------------------------------------------------------------
  */

  private getInstrumentGain(): GainNode {
    if (!this.instrumentGain) {
      throw new Error("AudioMixer has not been initialized.");
    }

    return this.instrumentGain;
  }

  /*
  |--------------------------------------------------------------------------
  | GET STREAM
  |--------------------------------------------------------------------------
  */

  getStream(): MediaStream {
    return this.getDestination().stream;
  }

  /*
  |--------------------------------------------------------------------------
  | DISPOSE
  |--------------------------------------------------------------------------
  */

  dispose(): void {
    /*
    |--------------------------------------------------------------------------
    | Disconnect microphone.
    |--------------------------------------------------------------------------
    */

    if (this.microphoneSource) {
      try {
        this.microphoneSource.disconnect();
      } catch {
        // Already disconnected.
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Disconnect instrument.
    |--------------------------------------------------------------------------
    */

    if (this.instrumentSource) {
      try {
        this.instrumentSource.disconnect();
      } catch {
        // Already disconnected.
      }
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
    | Disconnect gains.
    |--------------------------------------------------------------------------
    */

    if (this.microphoneGain) {
      try {
        this.microphoneGain.disconnect();
      } catch {
        // Already disconnected.
      }
    }

    if (this.instrumentGain) {
      try {
        this.instrumentGain.disconnect();
      } catch {
        // Already disconnected.
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Reset.
    |--------------------------------------------------------------------------
    */

    this.microphoneSource = null;

    this.microphoneStream = null;

    this.microphoneGain = null;

    this.instrumentSource = null;

    this.instrumentGain = null;

    this.destination = null;

    this.context = null;
  }
}

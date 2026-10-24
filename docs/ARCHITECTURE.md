# Architecture decisions

## Native rendering and readable labels

Skia draws the concentric sectors, center, borders, tick marks, and highlights. Gesture Handler 3 processes the inner-ring pan and annular taps. Reanimated shared values drive the ring transform on the UI thread. Native text labels counterrotate so they remain upright. Keeping the labels in React Native also gives assistive technology named controls; the tonic picker and rotation buttons provide alternatives to dragging.

Absolute pitch class zero is C. The twelve positions increase clockwise in semitone steps. The relative ring rotates by `tonic × π / 6`. A label's absolute pitch is `(tonic + interval) mod 12`, and an absolute note's relative interval is `(pitch − tonic) mod 12`. Drag deltas use `atan2(sin(delta), cos(delta))` to cross the ±π boundary without jumping. Release snaps to the nearest semitone, including negative angles and multiple revolutions. Cancellation returns the ring to the committed tonic.

Geometry is pure TypeScript and tested separately from rendering. React updates the committed tonic at the end of a drag. During movement, the UI thread animates the ring and sends only semitone crossings to JavaScript for optional haptics and sound.

The browser entry loads CanvasKit before importing the Skia wheel. Postinstall copies the matching WebAssembly runtime locally. The native entry imports the wheel directly. Platform-specific files keep browser initialization out of native startup.

## Pure musical model

The domain has no React, Expo, storage, or platform imports. Note spelling is a presentation preference; pitch classes stay numeric. Solfège accidental conventions are configurable independently of absolute spelling. Sargam distinguishes komal notes from shuddha notes and tivra Ma. Chromatic degrees use a reference convention; a selected scale supplies contextual degree and solfège spelling, including ♭5 / Se in minor blues.

Frequency uses scientific pitch notation: MIDI `(octave + 1) × 12 + pitchClass`, then `440 × 2^((midi − 69) / 12)`. The scale module retains unwrapped semitone distances so sequences cross octaves correctly. The same scale intervals drive membership, formulas, and playback. Classical descending melodic minor uses natural minor. Both directions are defined independently before reversing playback order, so the highlighted sixth and seventh match the sound.

## Offline audio with explicit ownership

Expo Audio provides maintained Android/iOS playback and is included in Expo Go. It is a file player rather than a sample-accurate oscillator. This MVP generates its own equal-tempered PCM tones ahead of time, with a short attack and release to reduce clicks. It does not change playback speed to transpose pitches.

Octaves 3–5 are selectable. Bundled octave 6 supports chromatic sequences starting anywhere in octave 5. Each selected octave's twelve notes are preloaded; other voices are created when needed. A single-voice engine pauses previous voices before playing a new one. Serialized seeks and generation counters prevent stale requests from restarting after Stop, a newer tap, or disposal. Tests inject fake voices to reproduce those races.

The melody hook owns note players, status subscriptions, sequence timers, and lifecycle cleanup. It cancels sequences when interrupted, stopped, or backgrounded. Volume changes update existing and future voices. No background playback or microphone permissions are enabled.

### Sustained drone

A second independent engine plays a looping tonic while the melody engine plays one note at a time. The drone cache holds only one player; retuning releases the previous player. Stopping a scale cancels only the melody. Stop all audio and background/unmount cleanup stop both. Drone intent is never persisted, so restoration cannot start audio unexpectedly.

The shared Expo voice adapter owns load timeouts, abort signals, status subscriptions, and player disposal. Eight-second drone assets have an integer number of cycles, constant amplitude, and matching phase at the loop boundary. Rounding the frame count shifts pitch by less than 0.01 cent across all 36 supported drone pitches. The quieter drone waveform leaves mixing headroom beneath note attacks. All PCM assets are bundled offline.

The selected approach retains Expo Go support and adds no native dependencies. Expo Audio controls file looping on each platform; sample-accurate scheduling and hardware loop joins cannot be established by a browser preview. Sequence timing uses JavaScript timers, and Bluetooth adds device-dependent latency. Physical-device tests must check loop joins, interruptions, audio latency, and haptics.

## Local preferences

AsyncStorage contains a versioned JSON snapshot. Decoding validates each field independently and falls back to defaults for malformed values. Hydration completes before the interactive screen appears, preventing defaults from overwriting saved preferences. Writes are debounced and serialized; the latest state is flushed when the app backgrounds or unmounts. Storage failures appear in the UI with a retry action.

Scale and direction are stored in the existing versioned snapshot. Older Phase 1 snapshots default the new direction field to ascending and retain their chosen scale. No service, account, analytics, or network API is needed to use the native app.

## Practice and navigation

Expo Router owns navigation in `src/app`: the explorer, practice hub, and a validated dynamic route for the four exercise modes. Root providers share fonts, safe areas, preferences, and practice progress. A single preference store prevents retained screens from writing stale snapshots. Focus cleanup stops explorer notes and its drone before practice begins; leaving an exercise cancels its sequence and pending listening completion. Returning never starts sound automatically.

`features/practice/exercises.ts` generates questions and grades rounds without React or platform dependencies. Prompt MIDI notes retain their octave crossings. Intervals use six beginner choices or all thirteen distances through the octave. Sargam uses the major shuddha ladder with a chosen Sa. Movable Do changes tonic between rounds; it asks for an absolute pitch and reveals major solfège positions after grading. The tonic wheel receives no correct pitch until the round is complete. Audio progress never highlights the mystery answer.

A round must finish a prompt before it accepts answers. Wrong choices remain visible and cannot be submitted twice; retries keep the round open. Hints and guided ladders mark assistance. Correct answers or explicit reveals finish the round once, with immediate feedback. A synchronous round reference guards rapid taps; playback request tokens prevent cancelled or superseded audio from unlocking another round. The generic melody sequence returns a completion boolean so Stop, interruptions, navigation, and failed playback cannot count as a finished listen.

`progress.ts` owns versioned decoding, aggregate counters, and streak rules. Unaided first-try answers extend a per-mode streak; retries, assistance, and reveals reset it. A bounded set of 128 recent round IDs rejects duplicate result delivery. The root progress provider hydrates before practice, serializes immediate completed-round writes, and flushes unsaved changes on background/unmount. An idle provider never writes its older snapshot during cleanup. Read failures block starting practice until retry, protecting unread data; write failures keep the session usable and show a retry action. There is no backend or cross-device synchronization, and unfinished rounds are not persisted.

## Dependencies

The project uses the stable Expo SDK 58 template and versions selected by `expo install`. It uses the New Architecture supplied by React Native 0.88. Skia, Gesture Handler, Reanimated/Worklets, Audio, Haptics, Safe Area Context, Font, and AsyncStorage are Expo Go-compatible for this SDK.

Sources checked during implementation: [Expo SDK versions](https://docs.expo.dev/versions/latest/), [Expo Audio SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/audio/), [Expo Router installation](https://docs.expo.dev/router/installation/), [Expo Skia setup](https://docs.expo.dev/versions/latest/sdk/skia/), and [Reanimated setup](https://docs.expo.dev/versions/latest/sdk/reanimated/). Installed TypeScript declarations were used to verify the SDK 58 and Gesture Handler 3 APIs.

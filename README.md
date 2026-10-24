# Pitch Master

A native music-learning app that connects absolute pitch, movable Do, Hindustani Sargam, and scale degrees. Built with Expo SDK 58, React Native 0.88, and strict TypeScript.

## Run it

Use Node.js 24 LTS and npm. From the project directory:

```sh
npm ci
npm start
```

Install a version of **Expo Go that supports SDK 58** on your Android phone or iPhone. Connect the phone and computer to the same Wi-Fi network, then scan the QR code. On iOS, scan with Camera; on Android, use Expo Go. Accept local-network access if your phone requests it. No microphone permission is needed.

```sh
npm run android       # Open a running Android emulator
npm run ios           # Open the iOS simulator (macOS required)
npm run web           # Browser preview
```

If Metro reports `Unable to deserialize cloned data`, stop the server with **Ctrl+C** and reset its cache:

```sh
npm run start:clear
```

This runs `expo start --clear` directly, so PowerShell does not need to forward the flag through npm. Once the cache is rebuilt, use `npm start` for normal development. See [Expo's Windows cache troubleshooting guide](https://docs.expo.dev/troubleshooting/clear-cache-windows/).

If your Expo Go release does not support SDK 58, use a development build. Install `expo-dev-client`, then run `npx expo run:android` with the Android SDK installed, or `npx expo run:ios` on a Mac with Xcode. This MVP uses libraries included in Expo Go; it does not require custom native audio code.

## Features

- A Skia wheel with fixed absolute notes and an independently rotating relative ring.
- Clockwise and counterclockwise dragging, 30° snapping, and rotation buttons.
- Tap an outer note to select and hear the tonic. Tap an inner note to hear that absolute pitch without changing the tonic. Tap the center to replay the tonic.
- Western solfège, Sargam, and numeric degrees. Absolute sharps/flats and raised/lowered solfège conventions are independent settings.
- A tonic picker, interval and frequency readouts, octave selection (3–5), and an ascending/descending chromatic listening sequence.
- Local preferences for tonic, notation, spelling, octave, tempo, volume, haptics, and sound during rotation.
- Bundled fonts, icons, and 48 generated audio tones. An installed native build works without a connection. During development, Expo Go downloads the JS and assets from Metro and may need the computer on the same network.

### Phase 2: scales and a tonic reference

- Choose major, natural minor, harmonic minor, melodic minor, major/minor pentatonic, major/minor blues, or chromatic.
- Scale notes are highlighted on both wheel rings; outside notes are dimmed and remain playable.
- Read the degree formula, semitone steps, and equivalent solfège and Sargam sequences below the wheel.
- Play the selected scale ascending or descending at the saved tempo, with the upper tonic in the correct octave. Classical melodic minor changes its formula and highlighted sixth/seventh when direction changes.
- Start a sustained tonic drone beneath notes or scales. It follows changes to the tonic and octave. **Stop scale** stops the melody and leaves the drone running; **Stop all audio** stops both. Backgrounding or closing the app stops sound.
- Scale and direction are saved. The drone always starts off when the app reopens.

### Phase 3: beginner ear training

Open the headphones button in the explorer header to enter Practice.

- **Find the tonic:** listen to a mystery tonic and choose its absolute pitch on a neutral wheel. A reference C lets you compare pitches without perfect pitch.
- **Interval recognition:** identify an ascending interval from two notes. Start with six intervals or choose all thirteen from unison through octave.
- **Sargam:** choose Sa, listen to the guided Sa–Ni–Sa ladder, then identify a relative syllable from two notes.
- **Movable Do:** a different tonic each round, listening prompts, and wheel answers. Feedback reveals how the major solfège positions moved.
- Replay, Stop, optional hints, immediate feedback, retries, and answer reveal. Answers unlock after a complete prompt; playback stops when leaving practice or backgrounding the app.
- Local progress by exercise: completed rounds, unaided first-try wins, assisted rounds, reveals, current streak, and best streak. Replaying or tapping repeatedly cannot award the same round twice. Hints, guided ladders, retries, and reveals break the unaided streak; every completed round still counts toward practice.

Progress is stored on this device, without an account or cloud sync. Incomplete rounds are not scored or restored. No microphone is used.

## Use the wheel

**Outer ring:** absolute pitches in chromatic order, starting with C at the top. **Inner ring:** intervals from the current tonic. Moving the inner ring clockwise raises the tonic; moving it counterclockwise lowers the tonic. Do, Sa, and degree 1 always align with the highlighted absolute note.

`re`, `ga`, `dha`, and `ni` indicate komal Sargam notes. `Ma⁺` means tivra Ma. The note details show the full names. This app teaches twelve-tone equal temperament with A4 = 440 Hz; Hindustani raga intonation can differ. Chromatic solfège can use Di/Ri/Fi/Si/Li or Ra/Me/Se/Le/Te. Numeric degrees use the reference convention 1, ♭2, 2, ♭3, 3, 4, ♯4, 5, ♭6, 6, ♭7, 7.

With a non-chromatic scale, degree and solfège labels follow that scale's interval spelling: minor blues uses ♭5 / Se, and minor thirds use ♭3 / Me. The outer ring keeps its chromatic sharp/flat spelling; it shows equal-tempered pitch positions, not diatonic key-signature spelling.

## Validate

```sh
npm run check         # Lint, strict TypeScript, and 62 automated tests
npm run export:web    # Production browser bundle
npx expo export --platform android --platform ios
npx expo install --check
npx expo-doctor
```

Tests cover all 144 pitch/tonic relationships, every scale in all twelve keys and both directions, formula spelling, octave crossings through B6, wheel hit testing, corrupt preference recovery, and audio cancellation races. Drone tests check tuning within 0.01 cent, phase continuity, steady amplitude, mixing headroom, independent playback, and releasing old players while retuning.

Practice tests cover all four question types, supported octaves and keys, difficulty ranges, changing Do, Sargam syllables, listening/answer gates, retries, assistance, reveals, duplicate results, streaks, saved progress decoding, and bounded history.

On restricted Windows environments, Hermes may need a writable temporary directory. Set `TEMP` and `TMP` to an existing directory within the workspace before exporting; see [verification notes](docs/VERIFICATION.md).

## Structure

```text
src/domain/musicTheory/  Pure pitch, notation, interval, frequency, and scale calculations
src/features/wheel/     Skia rendering, native gestures, hit testing, and snapping
src/features/scales/    Scale selection, formulas, and equivalent notation
src/features/audio/     Offline notes/drone, independent voice engines, Expo lifecycle
src/features/settings/  Validated versioned preferences, persistence, and settings UI
src/features/practice/  Pure exercise/progress rules, answer wheel, guided practice screens
src/app/                Expo Router explorer, practice hub, and exercise routes
src/components/         Accessible controls and tonic picker
src/theme/              Palette, bundled font names, and screen styles
src/PitchMaster.tsx     Screen composition and interaction coordination
tests/                  Domain, geometry, preferences, audio, and practice tests
scripts/                Reproducible tone/icon generation and local CanvasKit setup
```

`npm ci` runs the postinstall script that copies CanvasKit from the installed Skia dependency into `public/`. The browser preview does not fetch its renderer from a CDN. Native uses Skia directly and does not load this WebAssembly file. The browser preview is not an offline PWA.

Regenerate notes with `npm run generate:tones`, drone loops with `npm run generate:drones`, and icons with `node scripts/generate-brand.mjs`. The 48 note samples and 36 drone loops are original PCM WAVs, not third-party samples. Fonts and Feather icons retain their packages' licenses.

Read [architecture decisions](docs/ARCHITECTURE.md) and [verification / device checklist](docs/VERIFICATION.md) for implementation details and current test limits.

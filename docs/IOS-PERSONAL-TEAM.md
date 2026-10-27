# Install and renew Pitch Master on your own iPhone

This is the local Release installation procedure that worked on October 24, 2026,
using a free Apple Account and Xcode Personal Team signing. The final successful
build and installation used **Xcode → Product → Run with the Release configuration**.
Expo CLI prepared the native project and dependencies first.

The user confirmed that the installed app opened and played audio with the Mac
disconnected and internet access off. It does not require Expo Go or a running
development server. This was a launch/audio check, not the full physical-device
acceptance checklist in [VERIFICATION.md](VERIFICATION.md).

## Quick renewal after seven days

Free Personal Team provisioning profiles expire seven days after issuance. Rebuild
and install again to renew the app; the signing certificate does not need to be
recreated every week.

1. Connect the iPhone to this Mac by USB and unlock it. Keep internet access on
   during provisioning and any developer verification prompts.
2. Open the existing workspace from Terminal:

   ```sh
   cd /path/to/Pitch-Master
   open ios/PitchMaster.xcworkspace
   ```

3. In Xcode, select **PitchMaster** as the scheme and your **physical iPhone** as
   the run destination in the top toolbar.
4. Confirm **Product → Scheme → Edit Scheme → Run → Info → Build Configuration**
   is **Release**, then close the scheme editor.
5. Choose **Product → Run** (**⌘R**). Allow Xcode to renew provisioning and install
   the app. Enter your Mac login password if Keychain asks to allow code signing.
6. Open Pitch Master on the phone. If developer trust is requested, follow the
   device trust steps below.
7. Disconnect USB, close the app completely, turn off Wi-Fi and cellular data,
   reopen it, and tap a note to confirm offline launch and audio.

Replace `/path/to/Pitch-Master` with your local checkout's path. Keep the same
Personal Team and bundle identifier already configured in `app.json` under
`expo.ios.bundleIdentifier`.
Install over the existing app to retain its local settings and practice progress;
deleting the app removes its local data. Routine renewal uses the existing
workspace, dependencies, certificate, and Developer Mode setup.

If signing fails, use the signing checklist below. If `ios/PitchMaster.xcworkspace`
is missing, follow the initial project preparation steps.

## Initial Mac setup

The successful setup used Node.js **24.12.0**, Expo **58.0.19**, Xcode **27.1**,
CocoaPods **1.17.0**, and an iPhone running iOS **27.0.1**.

1. Install full Xcode. Apple offers a direct `.xip` download through
   [Apple Developer Downloads](https://developer.apple.com/download/all/?q=Xcode)
   if Mac App Store sign-in is unavailable. A free Apple Account is sufficient.
   Extract it, move `Xcode.app` into `/Applications`, open it, and complete setup
   with iOS support. Optional simulator runtimes are unnecessary for a physical
   iPhone installation.
2. Select Xcode in **Xcode → Settings → Locations → Command Line Tools**. If using
   Terminal instead, or if first-launch setup remains incomplete:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license
   sudo xcodebuild -runFirstLaunch
   ```

   Review and accept the license yourself. Enter the Mac administrator password
   when prompted.

3. Add your Apple Account in **Xcode → Settings → Apple Accounts**. It can differ
   from the iPhone's iCloud account. Select your **Personal Team** for this app.
4. Install CocoaPods if missing:

   ```sh
   brew install cocoapods
   pod --version
   ```

   This command assumes Homebrew is already installed, as it was on this Mac.

5. Check the toolchain:

   ```sh
   node --version
   xcode-select -p
   xcodebuild -version
   xcodebuild -checkFirstLaunchStatus
   ```

   Node must be version 24 or newer. `xcode-select -p` should show
   `/Applications/Xcode.app/Contents/Developer`, rather than the standalone
   Command Line Tools directory.

Allow space for Xcode, platform support, installation temporary files, and native
build caches. Starting with roughly **40–50 GB free** is a planning estimate, not
an exact installation requirement; this Mac had over 100 GB free before building.

## Pair the phone and enable Developer Mode

1. Connect the iPhone by USB, unlock it, and accept **Trust This Computer**.
2. In **Xcode 27**, open **Xcode → Open Developer Tool → Device Hub**. Use the
   sidebar filter for **Physical Devices**, select the phone, and complete pairing.
   Older instructions referring to **Window → Devices and Simulators** do not
   match Xcode 27's menus.
3. On the phone, open **Settings → Privacy & Security → Developer Mode**. Enable
   it, restart, then unlock the phone and confirm **Turn On** with the passcode.
4. Wait for Device Hub to show the phone ready before starting a build.

## Signing certificate and the WWDR trust fix

1. In **Xcode → Settings → Apple Accounts**, select the account and Personal Team,
   then **Manage Certificates**. Create **+ → Apple Development** if one does not
   already exist on this Mac.
2. In normal Mac Terminal, check that macOS recognizes a usable signing identity:

   ```sh
   security find-identity -v -p codesigning
   ```

   The working setup reported **1 valid identity**. An entry in Xcode's certificate
   list alone did not establish that the identity was trusted and usable.

3. If it reports zero identities, open **Keychain Access → login → My Certificates**.
   Find **Apple Development** and expand it to check for the matching private key.
   Select the certificate and read any trust or expiry warning.
4. In this installation, Keychain showed **“certificate is not trusted.”** Installing
   Apple's **Worldwide Developer Relations – G3** intermediate certificate fixed
   the trust chain:
   - Download **Worldwide Developer Relations – G3** from
     [Apple's certificate authority page](https://www.apple.com/certificateauthority/).
   - Double-click the downloaded `.cer` file and add it to the **login** keychain.
   - Keep certificate trust at **Use System Defaults**.
   - Repeat `security find-identity -v -p codesigning`; it then reported one valid
     identity.

This is a chain repair, not an instruction to force the development certificate
to **Always Trust**. If trust is valid but the private key is missing, the G3
intermediate cannot replace that key. Resolve the certificate/key pairing in Xcode
before building. Do not revoke working certificates as a routine renewal step.

## Prepare the project and fix CocoaPods HTTPS

Run these commands in normal Mac Terminal. During this session the agent's command
environment could not resolve download servers or access the phone/keychain, even
though commands in the user's Terminal could.

```sh
cd /path/to/Pitch-Master
npm ci
SSL_CERT_FILE=/opt/homebrew/etc/ca-certificates/cert.pem npx expo run:ios --device --configuration Release
```

Select the physical iPhone when prompted. Expo generates the native `ios/` project
when missing, installs Pods, and bundles JavaScript and assets for Release. The
`ios/` and `android/` directories are generated and Git-ignored; keep app configuration
in `app.json` and config plugins rather than editing generated source by hand.

The `SSL_CERT_FILE` prefix was the successful CocoaPods HTTPS workaround on this
Apple Silicon Mac. Ruby's default certificate path was
`/opt/homebrew/etc/openssl@4/cert.pem`, which did not exist, while Homebrew's CA
bundle at `/opt/homebrew/etc/ca-certificates/cert.pem` did exist. Explicitly selecting
the existing bundle allowed Pod installation to succeed after this error:

```text
Couldn't determine repo type for URL: https://cdn.cocoapods.org/
SSL_connect returned=1
```

The setting applies only to that command and its child processes; HTTPS certificate
verification remains enabled. Check the bundle path again if Homebrew changes.
This CocoaPods HTTPS fix is separate from the Apple WWDR signing-chain fix above.

If Expo stops at provisioning after preparing the project, continue in Xcode below.
The CLI attempt alone was not the final verified installation path in this session.

## Restore Skia frameworks after reinstalling JavaScript dependencies

After running `npm ci` with an existing `ios/` project, refresh CocoaPods before
building again in Xcode:

```sh
cd /path/to/Pitch-Master
SSL_CERT_FILE=/opt/homebrew/etc/ca-certificates/cert.pem pod install --project-directory=ios --no-repo-update
```

Skia 2.14.0 copies its prebuilt Apple frameworks from the installed
`react-native-skia-apple-*` packages into `@shopify/react-native-skia/libs/` during
Pod installation. Reinstalling `node_modules` removes that generated copy while
the existing Pods project still references it. The resulting Xcode error mentions
`rsync`, `libskia.xcframework/ios-arm64_arm64e/*`, and `No such file or directory`.
Running Pod installation restores the frameworks from the installed packages.

When it completes, build again with **Product → Run** in the existing workspace.
This repair does not require deleting the app, regenerating the native project,
or changing signing settings.

## Configure automatic signing and run Release in Xcode

```sh
cd /path/to/Pitch-Master
open ios/PitchMaster.xcworkspace
```

1. Open the **workspace**, not just `PitchMaster.xcodeproj`.
2. Click the blue **PitchMaster** project at the top of the left project navigator.
3. In the narrow column beside it, choose **PitchMaster under TARGETS** (the app
   icon), below the separate **PROJECT** entry.
4. Open **Signing & Capabilities**, select **All** to cover Debug and Release, and
   enable **Automatically manage signing**.
5. Select your **Personal Team** and confirm the bundle identifier matches
   `expo.ios.bundleIdentifier` in `app.json`. Wait for the signing warning to clear. The
   working screen showed **Xcode Managed Profile** and an **Apple Development**
   signing certificate.
6. Select the physical iPhone in the top toolbar. Set **Product → Scheme → Edit
   Scheme → Run → Info → Build Configuration → Release**.
7. Choose **Product → Run** (**⌘R**). Approve Keychain signing prompts if shown.

The first successful build reported roughly 340 warnings. It completed and the
installed app passed the offline launch/audio check; individual warnings were not
audited in this installation session.

Xcode's local signing and scheme selections live in generated/ignored native
files. If the native project is regenerated or you use a fresh clone, recheck
these selections. Native regeneration is unnecessary for routine weekly renewal.

## Trust the installed app on the iPhone

The first successful build could not launch until this separate device trust step:

1. Keep internet access enabled on the phone.
2. Open **Settings → General → VPN & Device Management**.
3. Under **Developer App**, select the signing account, tap **Trust**, and confirm
   any prompts shown by iOS.
4. Open Pitch Master from the Home Screen. No rebuild was needed for this step.
5. Verify offline operation using the final step of the quick renewal checklist.

## Errors encountered and the fixes that worked

| Error or symptom                                                               | Resolution                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Xcode tools still use `/Library/Developer/CommandLineTools`                    | Select full Xcode in Settings → Locations, or use `xcode-select --switch` above.                                                                 |
| CocoaPods CLI missing                                                          | Install it with `brew install cocoapods`.                                                                                                        |
| CocoaPods repository SSL connection failure                                    | Prefix the Expo command with the existing Homebrew `SSL_CERT_FILE` bundle path above.                                                            |
| `No code signing certificates are available` / zero valid identities           | Check certificate and private key in Keychain; the untrusted certificate here was repaired by installing Apple's WWDR G3 intermediate.           |
| Exit code 70; destination unavailable; `Developer Mode disabled`               | Enable Developer Mode on the iPhone, restart, confirm, and wait for Device Hub readiness.                                                        |
| Exit code 65; no development provisioning profile / automatic signing disabled | Open the workspace, check target signing for Release, and run Release directly from Xcode with the Personal Team. This was the successful route. |
| Build succeeds but `Developer App Certificate is not trusted` at launch        | Trust the developer account on the iPhone under VPN & Device Management.                                                                         |
| App stops opening after free provisioning expires                              | Reconnect and repeat the quick renewal procedure with the same team and bundle identifier.                                                       |

For a different failure, read the specific error rather than the exit code alone.
Expo's native build log is `.expo/xcodebuild.log`; Xcode's Issue navigator is **⌘5**.

## References

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Expo local compilation](https://docs.expo.dev/guides/local-app-development/)
- [Expo local Release builds](https://docs.expo.dev/guides/local-app-production/)
- [Apple Personal Team account limits](https://developer.apple.com/help/account/basics/about-your-developer-account/)
- [Apple WWDR intermediate certificates and G3 usage](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates/)
- [Apple Device Hub](https://developer.apple.com/documentation/xcode/pairing-your-devices-with-your-mac)

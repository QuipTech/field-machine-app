---
name: android-setup
description: Sets up, builds, and launches FIELD Machine on an Android tablet (physical or emulator). Use when the Android toolchain, Gradle build, tablet emulator, or first launch needs to be prepared or repaired.
---

You prepare the FIELD Machine React Native app to build and run on an Android
tablet. You work only in this repository.

## Read first

1. `AGENTS.md` (project rules: 200-line file limit, arrow functions, folder
   ownership, never report a check as passing unless it actually ran).
2. `package.json`, `android/build.gradle`, `android/app/build.gradle`,
   `android/settings.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`.
3. `src/native/` to see which native modules the JS expects.

## Known environment (verify, do not trust blindly)

- macOS. JDK 17. Android SDK at `~/Library/Android/sdk` (platform 36,
  build-tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1). `ANDROID_HOME` is not
  set and `emulator` is not on PATH, so export them in every shell command:
  `export ANDROID_HOME=~/Library/Android/sdk; export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH`
- No `cmdline-tools` (no `avdmanager`/`sdkmanager`).
- Existing AVDs: Medium_Phone_API_35, Pixel_8a_API_35, Pixel_Fold_API_35.
  None is a tablet. System images: android-35 google_apis_ps16k arm64-v8a and
  google_apis_playstore x86_64.
- Project `.nvmrc` requires Node 22; the default shell may have Node 20.
  If `nvm` is available, run `nvm use 22` (install if missing). If Node 22 is
  unavailable, continue on Node 20 and report it.

## Steps

1. **Device.** Run `adb devices -l`. If a physical tablet is attached, use it.
   Otherwise create a tablet AVD named `FIELD_Tablet_API_35` by copying the
   `Pixel_Fold_API_35` `.ini` and `.avd/config.ini` (not its disk images),
   fixing paths/names, and setting a 10-inch tablet profile:
   `hw.lcd.width=2560`, `hw.lcd.height=1600`, `hw.lcd.density=320`,
   `hw.initialOrientation=landscape`, remove fold-specific keys
   (`hw.sensor.hinge*`, `hw.displayRegion*`, foldable settings), and use the
   arm64-v8a image on Apple Silicon (`uname -m`). Boot it **with a window**
   (the user wants to watch) in the background:
   `emulator -avd FIELD_Tablet_API_35 -no-snapshot-load &`, then wait with
   `adb wait-for-device` and poll `getprop sys.boot_completed` until `1`.
2. **Config check.** Confirm RN 0.85.3 Android template is intact (Gradle
   wrapper version, autolinking in `settings.gradle`, `MainApplication.kt`).
   Confirm `react-native-webview` autolinks.
3. **Build.** Start Metro in the background (`npx react-native start
   --reset-cache`, log to the scratchpad). Then run
   `npx react-native run-android` (log to the scratchpad). If Gradle fails,
   read the real error, fix the root cause with the smallest change, and retry.
4. **Launch check.** Confirm the app process is running
   (`adb shell pidof com.fieldmachine`), capture a screenshot with
   `adb exec-out screencap -p > <scratchpad>/launch.png` and view it, and
   scan `adb logcat -d *:E ReactNativeJS:V` for fatal/JS errors.
5. Leave the emulator, Metro, and app **running** so the user can see it.

## Ask, don't decide (user rule — overrides everything below)

Do nothing on your own judgment. STOP and report back with your question
and findings instead of proceeding when you would: change any repo file
(even a "small" fix), choose between fixes for an error, install/upgrade/
switch anything (Node, SDK components, packages), or act in a situation
these instructions do not clearly cover. The explicitly listed steps
(AVD creation in `~/.android/avd`, booting, Metro, `run-android`,
screenshots, logcat) and read-only checks are allowed.

## Boundaries

- Allowed changes: Android Gradle/config files, `android/` generated project
  files when needed to build, and small JS fixes strictly required to launch.
  Keep hand-written files at or below 200 lines and follow AGENTS.md style.
- Do **not** modify `windows/`, do not touch other repositories, do not
  commit, push, or change git remotes.
- Do **not** implement Phase 4 Android native modules (SecureStore,
  FileSystem, ScreenCapture, InputControl, BackgroundService). If the app
  crashes because one is missing, capture the exact error, propose the
  smallest fix (e.g. a guarded JS fallback), and report it instead of
  building the module — unless a one-line guard is enough to reach the UI.
- Never print or store credentials. Do not run `npm audit fix --force`.

## Report back (concise)

- Device used and how it was created/booted.
- Node version used.
- Every file changed, with a one-line reason.
- Build result (with the real error text if it failed).
- Launch result: process running yes/no, what the screenshot shows, any
  logcat errors.
- Absolute paths to logs and screenshot.
- Blockers and anything you could not verify.

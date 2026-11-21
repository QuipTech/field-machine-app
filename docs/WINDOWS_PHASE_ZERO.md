# Windows Phase 0 setup and native checks

## Status

The project uses RNW 0.85.0 `cpp-app`, React Native 0.85.3, and C++ Windows
modules. Kotlin remains planned for Android. No Windows compilation or runtime
checks have run on the macOS development host. The user subsequently built and
launched the app on Windows and reported all Phase 0 capabilities working.
See TEST_PLAN.md for evidence and outstanding checks, and
[Windows Run.md](<Windows Run.md>) for the full setup and troubleshooting flow.

The Windows project was rendered from the installed official RNW template,
including its solution, packaging project, resources, NuGet configuration, and
Metro configuration. The normal RNW CLI could not initialize on macOS because
it requires Windows tools. Native sources were then added to the app project.
Generated template files are exempt from the 200-line rule.

## Build

1. Use a Windows development host and install the prerequisites from the
   [RNW setup guide](https://microsoft.github.io/react-native-windows/docs/rnw-dependencies).
2. Install Node 22.11+ and run `npm ci`.
3. Open `windows/FieldMachine.sln` and allow NuGet restore. The installed 0.85.0
   template selects the v145 C++ toolset; use a Visual Studio installation that
   provides it. Do not change architecture to resolve missing build tools.
4. Run `npm start` in one terminal and `npm run windows` in another.
5. Start with the unpackaged app for the capability spikes. MSIX signing,
   publisher identity (`CN=FIELD` is a placeholder), and sideload validation
   belong to the later Windows release phase.

Do not run `windows:init` over this project: it can replace the custom project
entries. The generated app's existing package provider calls
`AddAttributedModules(packageBuilder, true)`, registering the attributed modules
compiled into the application. `PhaseZeroModules.cpp` includes the header-only
capture module exactly once; the file and input modules register in their own
translation units. `d3d11.lib` and `dxgi.lib` are linked by the app project.

## Folder read/write

Quick manual sequence after the app launches:

1. Create `C:\FieldMachineTest` in File Explorer and add an existing file with
   known contents, such as `keep.txt`.
2. Enter `C:\FieldMachineTest` in the app's folder input.
3. Press **Test folder read/write**. Expect
   `Folder read/write and cleanup passed.`
4. Check the directory: `keep.txt` must remain unchanged and no
   `field-phase-zero-*.txt` test file should remain after completion.
5. Enter a nonexistent folder and repeat. Expect an error, with no success
   message and no changes to existing files.

Create a dedicated directory, for example `C:\FieldMachineTest`, and enter it
in the screen. The native implementation accepts an existing absolute local
folder, resolves it through a directory handle, and restricts filenames to the
Phase 0 prefix and a numeric suffix.

Files use exclusive `CREATE_NEW` access and a 4 KB limit. Only handles created
by the current module instance can be read or deleted. `DELETE_ON_CLOSE`
provides cleanup when the test finishes or the process closes. Existing files
must never be replaced. This narrow spike interface is not the production
FileSystem API or the brand-folder authorization implementation.

## Whole-screen capture

Press Start explicitly. The module uses `Windows.Graphics.Capture` with
`CreateForMonitor` for the entire primary monitor and a free-threaded D3D11
frame pool. It does not start at launch and does not bypass the Windows capture
indicator. This spike captures the primary monitor directly, without a picker.

Press Inspect after the first frame arrives. Confirm the PNG shows the whole
primary display. Inspect again and verify the frame count increases. The PNG
shows the first frame, not a live video preview. Stop closes the capture session
and frame pool and removes the temporary snapshot during normal cleanup.
An abnormal process exit can leave the PNG in the user's temporary directory;
remove any `field-phase-zero-capture*.png` test artifacts after the checks.

Screen encoding/streaming and operator-authorized support sessions belong to
later phases. Do not infer WebRTC readiness from this spike.

## Input check

Use an isolated test desktop. Press Send one click explicitly. The module
creates a dedicated native window on the UI dispatcher, brings it to the
foreground, checks that its center is unobscured, and inserts mouse move,
left-down, and left-up events with `SendInput`.

The target confirms receipt of the tagged injected button-up message. A
one-second timer rejects if no message arrives. A successful `SendInput` return
alone does not pass the test. Windows integrity restrictions can block injection;
do not disable them to make the spike pass. The target closes after the result.
No arbitrary coordinates or external-window input are exposed to JavaScript.

## Record evidence

Record Windows/tablet versions, toolchain, build configuration, folder, capture
snapshot/frame counts, input result, and any errors in `TEST_PLAN.md`. Phase 0
stays incomplete until launch and all three capability checks pass on Windows.

## Primary references

- [C++ native modules](https://microsoft.github.io/react-native-windows/docs/native-platform)
- [Capture frame pool](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded)
- [Monitor capture interop](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createformonitor)
- [SendInput behavior and restrictions](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)

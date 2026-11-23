# FIELD Machine on Windows 10 LTSC 2019

The FIELD Machine React Native Windows package requires build 18362 or later.
The separate x64 probe targets the client tablet's Windows 10 LTSC 2019 build
17763. It uses a Win32 C++ window and the installed Microsoft Edge WebView2
Runtime. The page is embedded in the executable and rendered from a local
virtual HTTPS origin. Screen capture requires an operator selection. The
preview stays on the tablet.

## Build

Open `windows/TabletCompatibility/CompatibilityProbe.vcxproj` with the
Windows C++ toolchain used by this repo. Build Release x64 and set the
`WebView2Sdk` MSBuild property to the `build/native` directory of the
Microsoft.Web.WebView2 SDK package. Verified SDK version is 1.0.3179.45.
Output is `artifacts/windows-tablet/compatibility/FieldMachine-LTSC2019-Probe-x64.exe`.
Sign the EXE using the existing approved FIELD test signer before distribution.

## Test on build 17763

1. Confirm the tablet is x64 and has Microsoft Edge WebView2 Runtime.
2. Run the signed probe as the normal tablet user. Expect a window titled
   **FIELD Machine LTSC 2019 Compatibility** and a **Picker ready** status.
3. Select **Choose a screen or window**. Cancel once and verify the button
   can be used again. Then choose a test window. Verify a moving local
   preview and **Capture active**.
4. Select **Stop capture** and verify the preview clears. Record the Windows
   build, whether the picker opened, and which step first failed, if any.

The Windows development laptop opened the signed probe, displayed the picker
with Window and Entire Screen choices, and canceled it successfully. The
tablet initially reported `0x80070002` during WebView2 startup. The operator
later reported the compatibility app working on the tablet.

## Per-user installer

Run `scripts/windows-tablet/New-LtscSetup.ps1 -App <signed LTSC pairing EXE>`
to create `artifacts/windows-tablet/compatibility/FieldMachine-LTSC2019-Setup-x64.exe`.
Supply `-SignTool` and `-CertificateThumbprint` to sign the setup with an
available approved publisher key.

Close the portable app before installing or updating. Run setup as the normal
tablet user, then open **FIELD Machine LTSC** from Start. Setup checks for the
x64 WebView2 Runtime. Install it separately if setup reports it missing.
Close and reopen from Start to check that the existing pairing is restored.
Close the app and use **Apps & features** to verify uninstall removes the app
and shortcut. Pairing credentials and the WebView2 profile are preserved.
The setup embeds the supplied LTSC app. Confirm the artifact name before
installing. The original setup contains the pairing-only build.

## Staging pairing build

Run `node scripts/windows-tablet/buildCompatibilityBundle.cjs`, then build the
same Release x64 project with `FieldMachineCompatibilityApp=true` and the same
`WebView2Sdk` setting. Sign the output with the FIELD test publisher.

Copy `artifacts/windows-tablet/compatibility/FieldMachine-LTSC2019-Pairing-x64.exe`
to the tablet and run it as the normal tablet user. This EXE embeds the shared
React Native UI and uses the installed WebView2 Runtime. Expect the purple
FIELD Machine screen with **Pair this tablet**. Use a staging Portal pairing
code. Close and reopen the app to verify that Windows PasswordVault retained
the pairing. The EXE does not need Metro.

The signed pairing EXE reached a ready pairing form after reading secure
storage on the development Windows machine. The workshop operator subsequently
reported that the desktop installer ran and showed the paired Ht-667 workspace.

## Staging build with screen sharing and Files

Build the same Release x64 compatibility project with the updated bundle.
Pass the resulting compatibility EXE to `New-LtscSetup.ps1` with
`-SetupFileName FieldMachine-LTSC2019-Setup-x64-native.exe` so the earlier
installer remains available. Close the running app before installing the update.

- In staging, connect to the paired tablet from the Portal. Confirm the request
  appears, first decline it, then repeat with **Allow view only**. Select a
  window, verify the Portal receives live video, and use **End remote access**.
  Repeat for an entire screen, cancel the picker once, and verify that a
  dropped connection or Portal End stops sharing.
- In Files, send a supported test document to the Portal and confirm the
  receipt is listed on the tablet after restarting. Send a staging design
  back, verify its project opens in Explorer, and compare the files and Portal
  status. Complete the remaining cases in [client requirements](CLIENT_REQUIREMENTS.md).
- Record Windows and WebView2 versions and the redacted Diagnostics timeline
  for any failed step. Verify on Ht-667 before using this build for cab support.

The tablet build reuses the Portal's Kinesis WebRTC flow for view-only sharing.
Selected document uploads are staged in app-managed storage. Design downloads
reuse the Windows range and SHA-256 implementation. Remote desktop control,
brand-folder reads and writes, and scheduled returns remain open on LTSC.

The November 22, 2026 Release x64 staging build compiled with the WebView2
1.0.3179.45 SDK. The setup payload matched the compiled executable by SHA-256.
Both executables are unsigned. The updated setup and its live staging
workflows have yet to be tested on the workshop tablet.
